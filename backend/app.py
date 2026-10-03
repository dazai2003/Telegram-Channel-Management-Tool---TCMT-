import io
import csv
from typing import List, Optional, Any, Union, Dict
from fastapi import FastAPI, HTTPException, Query, Response
from fastapi.staticfiles import StaticFiles
from fastapi.responses import StreamingResponse, FileResponse
from pydantic import BaseModel
from pathlib import Path

from backend.telegram_manager import tg_manager
from backend.config import load_config, save_config

app = FastAPI(title="Telegram Cross-Channel Member Auditor & Remover")

FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend"

# Request Schemas
class SendCodeRequest(BaseModel):
    phone: str
    api_id: Optional[int] = None
    api_hash: Optional[str] = None

class VerifyCodeRequest(BaseModel):
    code: str
    password: Optional[str] = None

class ScanRequest(BaseModel):
    paid_channel_id: Union[int, str]
    free_group_id: Union[int, str]

class RemoveRequest(BaseModel):
    free_group_id: Union[int, str]
    user_ids: List[int]
    delay: Optional[float] = 1.5

@app.get("/api/status")
async def get_status():
    return await tg_manager.get_auth_status()

@app.post("/api/auth/send-code")
async def send_code(req: SendCodeRequest):
    res = await tg_manager.request_code(
        phone=req.phone.strip(),
        api_id=req.api_id,
        api_hash=req.api_hash
    )
    if not res.get("success"):
        raise HTTPException(status_code=400, detail=res.get("error", "Failed to send code"))
    return res

@app.post("/api/auth/verify-code")
async def verify_code(req: VerifyCodeRequest):
    res = await tg_manager.sign_in_with_code(code=req.code.strip(), password=req.password)
    if not res.get("success"):
        return res
    return res

@app.post("/api/auth/logout")
async def logout():
    return await tg_manager.logout()

@app.get("/api/dialogs")
async def get_dialogs():
    res = await tg_manager.get_dialogs()
    if not res.get("success"):
        raise HTTPException(status_code=400, detail=res.get("error", "Failed to fetch dialogs"))
    return res

@app.post("/api/scan")
async def scan_channels(req: ScanRequest):
    # Convert integer-like strings to int
    paid_id = int(req.paid_channel_id) if str(req.paid_channel_id).lstrip('-').isdigit() else req.paid_channel_id
    free_id = int(req.free_group_id) if str(req.free_group_id).lstrip('-').isdigit() else req.free_group_id
    
    res = await tg_manager.scan_and_compare(paid_channel_id=paid_id, free_group_id=free_id)
    if not res.get("success"):
        raise HTTPException(status_code=400, detail=res.get("error", "Scan failed"))
    return res

@app.get("/api/scan/last")
async def get_last_scan():
    if tg_manager.last_scan_results:
        return tg_manager.last_scan_results
    return {"success": False, "message": "No scan performed yet"}

class RemoveStartRequest(BaseModel):
    free_group_id: Optional[Union[int, str]] = None
    user_ids: List[int]
    delay: Optional[float] = 1.5

@app.post("/api/remove/start")
async def start_removal_task(req: RemoveStartRequest):
    # Resolve free group ID if not provided
    free_id = req.free_group_id
    if not free_id and tg_manager.last_scan_results:
        free_id = tg_manager.last_scan_results.get("free_group", {}).get("id")
    if not free_id and tg_manager.config:
        free_id = tg_manager.config.get("last_free_group_id")

    if not free_id:
        raise HTTPException(status_code=400, detail="No target Free Group specified. Please select a group or perform a scan first.")

    if not req.user_ids:
        raise HTTPException(status_code=400, detail="No user IDs provided for removal.")

    # Convert integer-like strings
    clean_group_id = int(free_id) if str(free_id).lstrip('-').isdigit() else free_id

    task_id = tg_manager.create_removal_task(
        free_group_id=clean_group_id,
        user_ids=req.user_ids,
        delay=req.delay or 1.5
    )

    return {
        "success": True,
        "task_id": task_id,
        "total": len(req.user_ids),
        "group_id": clean_group_id
    }

@app.get("/api/remove/stream")
async def stream_remove(
    task_id: Optional[str] = Query(None),
    free_group_id: Optional[str] = Query(None),
    user_ids: Optional[str] = Query(None),
    delay: float = Query(1.5)
):
    if task_id:
        task = tg_manager.get_removal_task(task_id)
        if not task:
            raise HTTPException(status_code=404, detail="Removal task not found or already completed")
        group_id = task["free_group_id"]
        ids_list = task["user_ids"]
        pacing_delay = task.get("delay", 1.5)
    else:
        if not free_group_id or not user_ids:
            raise HTTPException(status_code=400, detail="Missing required parameters (task_id or free_group_id + user_ids)")
        group_id = int(free_group_id) if free_group_id.lstrip('-').isdigit() else free_group_id
        ids_list = [int(uid.strip()) for uid in user_ids.split(",") if uid.strip().lstrip('-').isdigit()]
        pacing_delay = delay

    if not ids_list:
        raise HTTPException(status_code=400, detail="No valid user IDs provided")

    return StreamingResponse(
        tg_manager.remove_members_stream(free_group_id=group_id, user_ids=ids_list, delay=pacing_delay),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )

@app.get("/api/export/csv")
async def export_csv():
    if not tg_manager.last_scan_results or not tg_manager.last_scan_results.get("overlapping_members"):
        raise HTTPException(status_code=400, detail="No scan data available to export")

    members = tg_manager.last_scan_results.get("overlapping_members", [])
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["User ID", "Full Name", "Username", "Phone", "Status"])

    for m in members:
        writer.writerow([
            m.get("id"),
            m.get("name"),
            f"@{m.get('username')}" if m.get("username") else "",
            m.get("phone") or "",
            m.get("status")
        ])

    output.seek(0)
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=overlapping_telegram_members.csv"}
    )

# =============================================================================
# Join Requests Approver Endpoints
# =============================================================================

class ChannelActionRequest(BaseModel):
    channel_id: Union[int, str]

class SingleApproveRequest(BaseModel):
    channel_id: Union[int, str]
    user_id: int
    approved: bool = True

class StreamApproveStartRequest(BaseModel):
    channel_id: Union[int, str]
    user_ids: Optional[List[int]] = None
    delay: Optional[float] = 1.0

class AutopilotStartRequest(BaseModel):
    channel_id: Union[int, str]
    interval_seconds: Optional[int] = 30

@app.get("/api/requests/list")
async def get_requests_list(
    channel_id: str = Query(...),
    limit: int = Query(200)
):
    clean_id = int(channel_id) if channel_id.lstrip('-').isdigit() else channel_id
    res = await tg_manager.get_pending_requests(channel_id=clean_id, limit=limit)
    if not res.get("success"):
        raise HTTPException(status_code=400, detail=res.get("error", "Failed to fetch join requests"))
    return res

@app.post("/api/requests/approve-all")
async def approve_all_requests(req: ChannelActionRequest):
    clean_id = int(req.channel_id) if str(req.channel_id).lstrip('-').isdigit() else req.channel_id
    res = await tg_manager.approve_all_requests_turbo(channel_id=clean_id)
    if not res.get("success"):
        raise HTTPException(status_code=400, detail=res.get("error", "Failed to approve all join requests"))
    return res

@app.post("/api/requests/approve-single")
async def approve_single_request(req: SingleApproveRequest):
    clean_id = int(req.channel_id) if str(req.channel_id).lstrip('-').isdigit() else req.channel_id
    res = await tg_manager.approve_single_request(channel_id=clean_id, user_id=req.user_id, approved=req.approved)
    if not res.get("success"):
        raise HTTPException(status_code=400, detail=res.get("error", "Failed to update join request"))
    return res

@app.post("/api/requests/stream/start")
async def start_approval_stream(req: StreamApproveStartRequest):
    clean_id = int(req.channel_id) if str(req.channel_id).lstrip('-').isdigit() else req.channel_id
    task_id = tg_manager.create_approval_task(
        channel_id=clean_id,
        user_ids=req.user_ids,
        delay=req.delay or 1.0
    )
    return {
        "success": True,
        "task_id": task_id
    }

@app.get("/api/requests/stream")
async def stream_approval(task_id: str = Query(...)):
    task = tg_manager.get_approval_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Approval task not found or already completed")

    return StreamingResponse(
        tg_manager.approve_requests_stream(
            channel_id=task["channel_id"],
            user_ids=task.get("user_ids"),
            delay=task.get("delay", 1.0)
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )

@app.post("/api/requests/autopilot/start")
async def start_autopilot(req: AutopilotStartRequest):
    clean_id = int(req.channel_id) if str(req.channel_id).lstrip('-').isdigit() else req.channel_id
    return tg_manager.start_autopilot(channel_id=clean_id, interval_seconds=req.interval_seconds or 30)

@app.post("/api/requests/autopilot/stop")
async def stop_autopilot():
    return tg_manager.stop_autopilot()

@app.get("/api/requests/autopilot/status")
async def get_autopilot_status():
    return tg_manager.get_autopilot_status()

@app.get("/api/requests/export/csv")
async def export_requests_csv(channel_id: str = Query(...)):
    clean_id = int(channel_id) if channel_id.lstrip('-').isdigit() else channel_id
    res = await tg_manager.get_pending_requests(channel_id=clean_id, limit=5000)
    if not res.get("success"):
        raise HTTPException(status_code=400, detail=res.get("error", "Failed to fetch join requests"))

    requests = res.get("requests", [])
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["User ID", "Full Name", "Username", "Phone", "Requested Date", "About / Bio"])

    for r in requests:
        writer.writerow([
            r.get("id"),
            r.get("name"),
            f"@{r.get('username')}" if r.get("username") else "",
            r.get("phone") or "",
            r.get("requested_date") or "",
            r.get("about") or ""
        ])

    output.seek(0)
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=pending_join_requests_{clean_id}.csv"}
    )

# =============================================================================
# Global Ban & Total Digital Wipeout Endpoints
# =============================================================================

class NukeStartRequest(BaseModel):
    target_query: str
    options: Optional[Dict[str, Any]] = None

class BlacklistAddRequest(BaseModel):
    id: int
    name: Optional[str] = ""
    username: Optional[str] = ""
    phone: Optional[str] = ""
    reason: Optional[str] = ""

@app.get("/api/nuke/resolve")
async def resolve_target(query: str = Query(...)):
    res = await tg_manager.resolve_target_user(query)
    if not res.get("success"):
        raise HTTPException(status_code=400, detail=res.get("error", "Target user not found"))
    return res

@app.post("/api/nuke/start")
async def start_nuke_task(req: NukeStartRequest):
    if not req.target_query:
        raise HTTPException(status_code=400, detail="Target query cannot be empty")

    task_id = tg_manager.create_nuke_task(
        target_query=req.target_query,
        options=req.options or {}
    )
    return {
        "success": True,
        "task_id": task_id
    }

@app.get("/api/nuke/stream")
async def stream_nuke(task_id: str = Query(...)):
    task = tg_manager.get_nuke_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Wipeout task not found or already completed")

    return StreamingResponse(
        tg_manager.nuke_user_stream(
            target_query=task["target_query"],
            options=task.get("options", {})
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )

@app.get("/api/blacklist/list")
async def get_blacklist():
    return {
        "success": True,
        "blacklist": tg_manager.get_blacklist()
    }

@app.post("/api/blacklist/add")
async def add_blacklist_entry(req: BlacklistAddRequest):
    res = tg_manager.add_to_blacklist(req.dict())
    return res

@app.delete("/api/blacklist/remove")
async def remove_blacklist_entry(user_id: int = Query(...)):
    res = tg_manager.remove_from_blacklist(user_id)
    return res

# Mount frontend
app.mount("/", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")

