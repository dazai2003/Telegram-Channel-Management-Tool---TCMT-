import os
import json
import asyncio
import logging
from typing import Dict, List, Optional, Any, AsyncGenerator
from telethon import TelegramClient, errors
from telethon.tl.types import (
    Channel,
    Chat,
    User,
    InputUserEmpty,
    ChatBannedRights,
    ChannelParticipantAdmin,
    ChannelParticipantCreator
)
from telethon.tl.functions.channels import (
    GetParticipantsRequest,
    EditBannedRequest,
    DeleteParticipantHistoryRequest,
    ToggleParticipantsHiddenRequest
)
from telethon.tl.functions.messages import (
    GetChatInviteImportersRequest,
    HideChatJoinRequestRequest,
    HideAllChatJoinRequestsRequest,
    DeleteHistoryRequest,
    DeleteChatUserRequest,
    ExportChatInviteRequest,
    EditExportedChatInviteRequest
)
from telethon.tl.functions.contacts import (
    BlockRequest,
    UnblockRequest,
    DeleteContactsRequest
)
from telethon.tl.types import ChannelParticipantsSearch, ChannelParticipantsAdmins
from backend.config import SESSION_FILE, load_config, save_config, load_blacklist, save_blacklist
import datetime

logger = logging.getLogger("telegram_manager")
logging.basicConfig(level=logging.INFO)

class TelegramManager:
    def __init__(self):
        self.config = load_config()
        self.client: Optional[TelegramClient] = None
        self.phone_code_hash: Optional[str] = None
        self.phone_requested: Optional[str] = None
        self.is_scanning: bool = False
        self.is_removing: bool = False
        self.last_scan_results: Optional[Dict[str, Any]] = None
        self.cached_users: Dict[int, Any] = {}
        self.cached_entities: Dict[Any, Any] = {}
        self.active_tasks: Dict[str, Dict[str, Any]] = {}
        self.active_approval_tasks: Dict[str, Dict[str, Any]] = {}
        self.active_nuke_tasks: Dict[str, Dict[str, Any]] = {}
        self.removal_queue = asyncio.Queue()
        
        # Auto-Pilot join request approver state
        self.autopilot_active: bool = False
        self.autopilot_channel_id: Optional[Any] = None
        self.autopilot_channel_title: str = ""
        self.autopilot_task: Optional[asyncio.Task] = None
        self.autopilot_approved_count: int = 0
        self.autopilot_last_run: Optional[float] = None
        self.autopilot_interval: int = 30
        self.autopilot_logs: List[str] = []

    def create_removal_task(self, free_group_id: Any, user_ids: List[int], delay: float = 1.5) -> str:
        import uuid
        task_id = str(uuid.uuid4())
        self.active_tasks[task_id] = {
            "free_group_id": free_group_id,
            "user_ids": user_ids,
            "delay": delay
        }
        return task_id

    def get_removal_task(self, task_id: str) -> Optional[Dict[str, Any]]:
        return self.active_tasks.get(task_id)

    def create_approval_task(self, channel_id: Any, user_ids: Optional[List[int]] = None, delay: float = 1.0) -> str:
        import uuid
        task_id = str(uuid.uuid4())
        self.active_approval_tasks[task_id] = {
            "channel_id": channel_id,
            "user_ids": user_ids,
            "delay": delay
        }
        return task_id

    def get_approval_task(self, task_id: str) -> Optional[Dict[str, Any]]:
        return self.active_approval_tasks.get(task_id)

    def create_nuke_task(self, target_query: str, options: Dict[str, Any]) -> str:
        import uuid
        task_id = str(uuid.uuid4())
        self.active_nuke_tasks[task_id] = {
            "target_query": target_query,
            "options": options
        }
        return task_id

    def get_nuke_task(self, task_id: str) -> Optional[Dict[str, Any]]:
        return self.active_nuke_tasks.get(task_id)

    # =========================================================================
    # Persistent Blacklist Sentinel Management
    # =========================================================================

    def get_blacklist(self) -> List[Dict[str, Any]]:
        return load_blacklist()

    def add_to_blacklist(self, user_dict: Dict[str, Any]) -> Dict[str, Any]:
        current = load_blacklist()
        user_id = user_dict.get("id")
        # Check if already exists
        existing = next((b for b in current if b.get("id") == user_id), None)
        if existing:
            existing.update(user_dict)
            existing["updated_at"] = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        else:
            entry = {
                "id": user_id,
                "name": user_dict.get("name") or "Unknown User",
                "username": user_dict.get("username") or "",
                "phone": user_dict.get("phone") or "",
                "reason": user_dict.get("reason") or "Harassment / Bad Actor Nuke",
                "banned_at": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "chats_banned_count": user_dict.get("chats_banned_count", 0)
            }
            current.insert(0, entry)
        save_blacklist(current)
        return {"success": True, "blacklist": current}

    def remove_from_blacklist(self, user_id: int) -> Dict[str, Any]:
        current = load_blacklist()
        filtered = [b for b in current if b.get("id") != user_id]
        save_blacklist(filtered)
        return {"success": True, "blacklist": filtered}


    def _get_client(self) -> TelegramClient:
        if self.client is None:
            api_id = int(self.config.get("api_id"))
            api_hash = str(self.config.get("api_hash"))
            self.client = TelegramClient(
                str(SESSION_FILE),
                api_id,
                api_hash,
                device_model="ChannelSync Desktop",
                system_version="Windows 11",
                app_version="1.0.0"
            )
        return self.client

    async def _resolve_entity(self, entity_id: Any) -> Any:
        client = self._get_client()
        if entity_id in self.cached_entities:
            return self.cached_entities[entity_id]

        try:
            entity = await client.get_entity(entity_id)
            self.cached_entities[entity_id] = entity
            return entity
        except Exception:
            pass

        # Try with -100 prefix if integer
        if isinstance(entity_id, int):
            try:
                entity = await client.get_entity(int(f"-100{abs(entity_id)}"))
                self.cached_entities[entity_id] = entity
                return entity
            except Exception:
                pass
        elif isinstance(entity_id, str) and entity_id.lstrip('-').isdigit():
            clean_digits = entity_id.lstrip('-')
            for candidate in [int(entity_id), int(f"-100{clean_digits}")]:
                try:
                    entity = await client.get_entity(candidate)
                    self.cached_entities[entity_id] = entity
                    return entity
                except Exception:
                    pass

        return await client.get_entity(entity_id)

    async def ensure_connected(self) -> bool:
        client = self._get_client()
        if not client.is_connected():
            await client.connect()
        return await client.is_user_authorized()

    async def get_auth_status(self) -> Dict[str, Any]:
        try:
            authorized = await self.ensure_connected()
            if authorized:
                me = await self.client.get_me()
                return {
                    "is_authorized": True,
                    "user": {
                        "id": me.id,
                        "first_name": me.first_name,
                        "last_name": me.last_name,
                        "username": me.username,
                        "phone": me.phone
                    },
                    "config": self.config
                }
            return {
                "is_authorized": False,
                "user": None,
                "config": self.config
            }
        except Exception as e:
            logger.error(f"Error checking auth status: {e}")
            return {
                "is_authorized": False,
                "user": None,
                "error": str(e),
                "config": self.config
            }

    async def request_code(self, phone: str, api_id: Optional[int] = None, api_hash: Optional[str] = None) -> Dict[str, Any]:
        if api_id and api_hash:
            self.config["api_id"] = int(api_id)
            self.config["api_hash"] = str(api_hash)
            save_config(self.config)
            if self.client:
                await self.client.disconnect()
                self.client = None

        self.config["phone"] = phone
        save_config(self.config)

        client = self._get_client()
        if not client.is_connected():
            await client.connect()

        try:
            sent = await client.send_code_request(phone)
            self.phone_code_hash = sent.phone_code_hash
            self.phone_requested = phone
            return {"success": True, "message": f"Verification code sent to {phone}"}
        except Exception as e:
            logger.error(f"Failed to request code: {e}")
            return {"success": False, "error": str(e)}

    async def sign_in_with_code(self, code: str, password: Optional[str] = None) -> Dict[str, Any]:
        client = self._get_client()
        if not client.is_connected():
            await client.connect()

        phone = self.phone_requested or self.config.get("phone")
        if not phone or not self.phone_code_hash:
            return {"success": False, "error": "No pending code request found. Please request code first."}

        try:
            await client.sign_in(phone=phone, code=code, phone_code_hash=self.phone_code_hash)
            me = await client.get_me()
            return {
                "success": True,
                "message": f"Successfully logged in as {me.first_name}",
                "user": {
                    "id": me.id,
                    "first_name": me.first_name,
                    "username": me.username
                }
            }
        except errors.SessionPasswordNeededError:
            if password:
                try:
                    await client.sign_in(password=password)
                    me = await client.get_me()
                    return {
                        "success": True,
                        "message": f"Successfully logged in with 2FA as {me.first_name}",
                        "user": {
                            "id": me.id,
                            "first_name": me.first_name,
                            "username": me.username
                        }
                    }
                except Exception as p_err:
                    return {"success": False, "requires_2fa": True, "error": f"Invalid 2FA password: {p_err}"}
            return {"success": False, "requires_2fa": True, "error": "Two-step verification (2FA) password required."}
        except Exception as e:
            logger.error(f"Failed to sign in: {e}")
            return {"success": False, "error": str(e)}

    async def logout(self) -> Dict[str, Any]:
        try:
            if self.client:
                if self.client.is_connected() and await self.client.is_user_authorized():
                    await self.client.log_out()
                await self.client.disconnect()
                self.client = None
            
            # Remove session file if exists
            for f in os.listdir(SESSION_DIR):
                if f.startswith("telegram_account"):
                    try:
                        os.remove(os.path.join(SESSION_DIR, f))
                    except Exception:
                        pass
            return {"success": True, "message": "Logged out successfully"}
        except Exception as e:
            return {"success": False, "error": str(e)}

    async def get_dialogs(self) -> Dict[str, Any]:
        authorized = await self.ensure_connected()
        if not authorized:
            return {"success": False, "error": "Not logged in to Telegram"}

        try:
            dialogs = []
            async for dialog in self.client.iter_dialogs():
                entity = dialog.entity
                if isinstance(entity, Channel):
                    # Check if channel or supergroup
                    is_group = entity.megagroup
                    is_broadcast = entity.broadcast
                    is_admin = bool(entity.admin_rights or entity.creator)
                    
                    dialogs.append({
                        "id": entity.id,
                        "title": entity.title,
                        "username": entity.username,
                        "type": "group" if is_group else "channel",
                        "is_broadcast": is_broadcast,
                        "is_megagroup": is_group,
                        "is_admin": is_admin,
                        "is_creator": bool(entity.creator),
                        "participants_count": getattr(entity, 'participants_count', None)
                    })
            
            return {"success": True, "dialogs": dialogs}
        except Exception as e:
            logger.error(f"Error fetching dialogs: {e}")
            return {"success": False, "error": str(e)}

    async def _fetch_all_participants(self, entity: Any) -> Dict[int, Dict[str, Any]]:
        """Fetch all participants of a channel or supergroup with retry and pagination."""
        participants_map: Dict[int, Dict[str, Any]] = {}
        client = self._get_client()

        # First, fetch admins to protect them
        admins_ids = set()
        try:
            async for admin in client.iter_participants(entity, filter=ChannelParticipantsAdmins):
                admins_ids.add(admin.id)
                self.cached_users[admin.id] = admin
        except Exception as e:
            logger.warning(f"Could not explicitly fetch admin list: {e}")

        # Fetch all participants
        try:
            async for user in client.iter_participants(entity, aggressive=True):
                if not isinstance(user, User):
                    continue
                
                self.cached_users[user.id] = user
                is_admin = user.id in admins_ids or getattr(user, 'is_self', False)
                participants_map[user.id] = {
                    "id": user.id,
                    "first_name": user.first_name or "",
                    "last_name": user.last_name or "",
                    "name": f"{user.first_name or ''} {user.last_name or ''}".strip() or "Telegram User",
                    "username": user.username,
                    "phone": user.phone,
                    "is_bot": bool(user.bot),
                    "is_admin": is_admin,
                    "is_deleted": bool(user.deleted)
                }
        except Exception as e:
            logger.error(f"Error iterating participants: {e}")
            raise e

        return participants_map

    async def scan_and_compare(self, paid_channel_id: Any, free_group_id: Any) -> Dict[str, Any]:
        authorized = await self.ensure_connected()
        if not authorized:
            return {"success": False, "error": "Not logged in to Telegram"}

        if self.is_scanning:
            return {"success": False, "error": "Scan already in progress"}

        self.is_scanning = True
        try:
            paid_entity = await self._resolve_entity(paid_channel_id)
            free_entity = await self._resolve_entity(free_group_id)

            paid_title = getattr(paid_entity, 'title', str(paid_channel_id))
            free_title = getattr(free_entity, 'title', str(free_group_id))

            logger.info(f"Scanning Paid Channel: {paid_title}")
            paid_members = await self._fetch_all_participants(paid_entity)

            logger.info(f"Scanning Free Group: {free_title}")
            free_members = await self._fetch_all_participants(free_entity)

            # Find overlapping members (in Paid AND in Free)
            overlapping_users: List[Dict[str, Any]] = []
            for user_id, user_data in paid_members.items():
                if user_id in free_members:
                    free_user = free_members[user_id]
                    # Exclude admins/bots from removal recommendation for safety
                    if free_user.get("is_admin") or free_user.get("is_bot"):
                        continue
                    
                    overlapping_users.append({
                        **free_user,
                        "in_paid_channel": True,
                        "in_free_group": True,
                        "status": "In Both Channels (Ready for Removal)"
                    })

            # Save last config selections
            self.config["last_paid_channel_id"] = paid_channel_id
            self.config["last_free_group_id"] = free_group_id
            save_config(self.config)

            results = {
                "success": True,
                "paid_channel": {
                    "id": getattr(paid_entity, 'id', paid_channel_id),
                    "title": paid_title,
                    "total_members": len(paid_members)
                },
                "free_group": {
                    "id": getattr(free_entity, 'id', free_group_id),
                    "title": free_title,
                    "total_members": len(free_members)
                },
                "overlap_count": len(overlapping_users),
                "overlapping_members": overlapping_users,
                "timestamp": asyncio.get_event_loop().time()
            }

            self.last_scan_results = results
            return results

        except Exception as e:
            logger.error(f"Scan failed: {e}", exc_info=True)
            return {"success": False, "error": f"Scan failed: {str(e)}"}
        finally:
            self.is_scanning = False

    async def remove_members_stream(self, free_group_id: Any, user_ids: List[int], delay: float = 1.5) -> AsyncGenerator[str, None]:
        authorized = await self.ensure_connected()
        if not authorized:
            yield f"data: {json.dumps({'event': 'error', 'message': 'Not authorized in Telegram'})}\n\n"
            return

        if self.is_removing:
            yield f"data: {json.dumps({'event': 'error', 'message': 'Removal operation already active'})}\n\n"
            return

        self.is_removing = True
        client = self._get_client()

        total = len(user_ids)
        successful = 0
        failed = 0

        # Permanent ban rights from group
        banned_rights = ChatBannedRights(
            until_date=None,
            view_messages=True,
            send_messages=True,
            send_media=True,
            send_stickers=True,
            send_gifs=True,
            send_games=True,
            send_inline=True,
            embed_links=True
        )

        try:
            free_entity = await self._resolve_entity(free_group_id)
            group_title = getattr(free_entity, 'title', str(free_group_id))
            yield f"data: {json.dumps({'event': 'start', 'total': total, 'group_title': group_title})}\n\n"

            for index, user_id in enumerate(user_ids, 1):
                try:
                    # Look up user in cache first, then client lookup
                    user_target = self.cached_users.get(user_id)
                    if not user_target:
                        try:
                            user_target = await client.get_entity(user_id)
                        except Exception:
                            user_target = user_id

                    user_name = f"{getattr(user_target, 'first_name', '')} {getattr(user_target, 'last_name', '')}".strip() if hasattr(user_target, 'first_name') else str(user_id)
                    username = f"@{user_target.username}" if getattr(user_target, 'username', None) else ""

                    # Execute ban via Telethon
                    try:
                        await client(EditBannedRequest(
                            channel=free_entity,
                            participant=user_target,
                            banned_rights=banned_rights
                        ))
                    except Exception as direct_ban_err:
                        # Fallback to client.edit_permissions
                        await client.edit_permissions(
                            entity=free_entity,
                            user=user_target,
                            view_messages=False,
                            send_messages=False
                        )

                    successful += 1
                    msg = f"[{index}/{total}] Successfully removed: {user_name} {username} [ID: {user_id}]"
                    logger.info(msg)
                    yield f"data: {json.dumps({'event': 'progress', 'current': index, 'total': total, 'user_id': user_id, 'user_name': user_name, 'status': 'success', 'message': msg})}\n\n"

                except errors.FloodWaitError as flood_err:
                    wait_seconds = flood_err.seconds
                    msg = f"Telegram FloodWait: Pausing for {wait_seconds}s before retrying user ID {user_id}..."
                    logger.warning(msg)
                    yield f"data: {json.dumps({'event': 'flood_wait', 'wait_seconds': wait_seconds, 'message': msg})}\n\n"
                    await asyncio.sleep(wait_seconds + 1)
                    
                    # Retry once
                    try:
                        await client(EditBannedRequest(
                            channel=free_entity,
                            participant=user_target if 'user_target' in locals() else user_id,
                            banned_rights=banned_rights
                        ))
                        successful += 1
                        msg = f"[{index}/{total}] (After wait) Successfully removed user ID: {user_id}"
                        yield f"data: {json.dumps({'event': 'progress', 'current': index, 'total': total, 'user_id': user_id, 'status': 'success', 'message': msg})}\n\n"
                    except Exception as retry_err:
                        failed += 1
                        msg = f"[{index}/{total}] Failed to remove user ID {user_id}: {retry_err}"
                        yield f"data: {json.dumps({'event': 'progress', 'current': index, 'total': total, 'user_id': user_id, 'status': 'failed', 'message': msg})}\n\n"

                except Exception as err:
                    failed += 1
                    msg = f"[{index}/{total}] Failed to remove user ID {user_id}: {str(err)}"
                    logger.error(msg)
                    yield f"data: {json.dumps({'event': 'progress', 'current': index, 'total': total, 'user_id': user_id, 'status': 'failed', 'message': msg})}\n\n"

                # Safe pacing
                await asyncio.sleep(delay)

            # Update last scan results to remove deleted users from state
            if self.last_scan_results and "overlapping_members" in self.last_scan_results:
                removed_set = set(user_ids[:successful])
                self.last_scan_results["overlapping_members"] = [
                    m for m in self.last_scan_results["overlapping_members"] if m["id"] not in removed_set
                ]
                self.last_scan_results["overlap_count"] = len(self.last_scan_results["overlapping_members"])

            yield f"data: {json.dumps({'event': 'complete', 'successful': successful, 'failed': failed, 'total': total})}\n\n"

        except Exception as e:
            logger.error(f"Removal task error: {e}", exc_info=True)
            yield f"data: {json.dumps({'event': 'error', 'message': f'Fatal error during removal: {str(e)}'})}\n\n"
        finally:
            self.is_removing = False

    # =========================================================================
    # Join Request Approver Methods
    # =========================================================================

    async def get_pending_requests(self, channel_id: Any, limit: int = 200) -> Dict[str, Any]:
        authorized = await self.ensure_connected()
        if not authorized:
            return {"success": False, "error": "Not logged in to Telegram"}

        try:
            client = self._get_client()
            entity = await self._resolve_entity(channel_id)
            channel_title = getattr(entity, 'title', str(channel_id))

            pending_users = []
            total_count = 0
            offset_date = None
            offset_user = None

            # Page through join requests up to limit
            while len(pending_users) < limit:
                batch_limit = min(100, limit - len(pending_users))
                res = await client(GetChatInviteImportersRequest(
                    peer=entity,
                    requested=True,
                    limit=batch_limit,
                    offset_date=offset_date,
                    offset_user=offset_user if offset_user else InputUserEmpty()
                ))

                total_count = getattr(res, 'count', len(res.importers))
                if not res.importers:
                    break

                # Create user lookup
                user_dict = {u.id: u for u in res.users}

                for importer in res.importers:
                    u = user_dict.get(importer.user_id)
                    if u:
                        self.cached_users[u.id] = u
                        user_name = f"{getattr(u, 'first_name', '') or ''} {getattr(u, 'last_name', '') or ''}".strip() or "Telegram User"
                        date_str = importer.date.strftime("%Y-%m-%d %H:%M:%S") if hasattr(importer, 'date') and importer.date else ""

                        pending_users.append({
                            "id": u.id,
                            "name": user_name,
                            "first_name": u.first_name or "",
                            "last_name": u.last_name or "",
                            "username": u.username or "",
                            "phone": u.phone or "",
                            "requested_date": date_str,
                            "about": getattr(importer, 'about', '') or ""
                        })

                if len(res.importers) < batch_limit:
                    break

                # Set offsets for next page
                last_importer = res.importers[-1]
                offset_date = last_importer.date
                last_user = user_dict.get(last_importer.user_id)
                if last_user:
                    try:
                        offset_user = await client.get_input_entity(last_user)
                    except Exception:
                        break
                else:
                    break

            return {
                "success": True,
                "channel_id": getattr(entity, 'id', channel_id),
                "channel_title": channel_title,
                "total_pending": total_count,
                "fetched_count": len(pending_users),
                "requests": pending_users
            }

        except Exception as e:
            logger.error(f"Failed to fetch join requests: {e}", exc_info=True)
            return {"success": False, "error": f"Failed to fetch join requests: {str(e)}"}

    async def approve_all_requests_turbo(self, channel_id: Any, max_batches: int = 300) -> Dict[str, Any]:
        """Systematically approve all pending join requests across all batches until 0 remain in one click."""
        authorized = await self.ensure_connected()
        if not authorized:
            return {"success": False, "error": "Not logged in to Telegram"}

        try:
            client = self._get_client()
            entity = await self._resolve_entity(channel_id)
            channel_title = getattr(entity, 'title', str(channel_id))

            # Initial check of total pending
            init_res = await client(GetChatInviteImportersRequest(
                peer=entity,
                requested=True,
                limit=1,
                offset_date=None,
                offset_user=InputUserEmpty()
            ))
            initial_count = getattr(init_res, 'count', len(init_res.importers))
            
            if not init_res.importers or initial_count == 0:
                return {
                    "success": True,
                    "message": f"No pending join requests in {channel_title}.",
                    "total_approved": 0,
                    "channel_title": channel_title
                }

            batches_run = 0
            total_cleared = 0
            last_remaining = initial_count

            while batches_run < max_batches:
                batches_run += 1
                
                try:
                    await client(HideAllChatJoinRequestsRequest(
                        peer=entity,
                        approved=True
                    ))
                except errors.FloodWaitError as flood_err:
                    logger.warning(f"Telegram FloodWait during turbo approve: waiting {flood_err.seconds}s")
                    await asyncio.sleep(flood_err.seconds + 1)
                    continue

                # Check remaining pending join requests
                check_res = await client(GetChatInviteImportersRequest(
                    peer=entity,
                    requested=True,
                    limit=1,
                    offset_date=None,
                    offset_user=InputUserEmpty()
                ))

                remaining = getattr(check_res, 'count', len(check_res.importers))
                if not check_res.importers or remaining == 0:
                    total_cleared = initial_count
                    logger.info(f"All join requests cleared for {channel_title} in {batches_run} batches.")
                    break

                # If HideAll didn't reduce the count, fall back to fetching and approving current batch
                if remaining >= last_remaining and check_res.importers:
                    batch_importers_res = await client(GetChatInviteImportersRequest(
                        peer=entity,
                        requested=True,
                        limit=50,
                        offset_date=None,
                        offset_user=InputUserEmpty()
                    ))
                    for imp in batch_importers_res.importers:
                        try:
                            u_target = self.cached_users.get(imp.user_id) or imp.user_id
                            await client(HideChatJoinRequestRequest(
                                peer=entity,
                                user_id=u_target,
                                approved=True
                            ))
                        except Exception:
                            pass
                    await asyncio.sleep(0.3)

                last_remaining = remaining
                await asyncio.sleep(0.4)

            msg = f"Successfully approved all pending join requests for {channel_title} ({initial_count} requests processed across {batches_run} batches)"
            logger.info(msg)
            return {
                "success": True,
                "message": msg,
                "channel_title": channel_title,
                "initial_count": initial_count,
                "batches_run": batches_run
            }

        except Exception as e:
            logger.error(f"Turbo approve failed: {e}", exc_info=True)
            return {"success": False, "error": f"Turbo approve failed: {str(e)}"}

    async def approve_single_request(self, channel_id: Any, user_id: int, approved: bool = True) -> Dict[str, Any]:
        """Approve or dismiss a single user's join request."""
        authorized = await self.ensure_connected()
        if not authorized:
            return {"success": False, "error": "Not logged in to Telegram"}

        try:
            client = self._get_client()
            entity = await self._resolve_entity(channel_id)
            user_target = self.cached_users.get(user_id) or await client.get_input_entity(user_id)

            await client(HideChatJoinRequestRequest(
                peer=entity,
                user_id=user_target,
                approved=approved
            ))

            action_name = "approved" if approved else "dismissed"
            return {
                "success": True,
                "message": f"Join request {action_name} for user ID {user_id}"
            }

        except Exception as e:
            logger.error(f"Failed to process join request for user {user_id}: {e}")
            return {"success": False, "error": str(e)}

    async def approve_requests_stream(self, channel_id: Any, user_ids: Optional[List[int]] = None, delay: float = 0.8) -> AsyncGenerator[str, None]:
        """Step-by-step or continuous multi-batch approval stream with live SSE progress, terminal logging and rate limit protection."""
        authorized = await self.ensure_connected()
        if not authorized:
            yield f"data: {json.dumps({'event': 'error', 'message': 'Not authorized in Telegram'})}\n\n"
            return

        client = self._get_client()
        successful = 0
        failed = 0

        try:
            entity = await self._resolve_entity(channel_id)
            channel_title = getattr(entity, 'title', str(channel_id))

            # MODE A: Specific User IDs Selected (Granular Step-by-Step Approval)
            if user_ids and len(user_ids) > 0:
                total = len(user_ids)
                yield f"data: {json.dumps({'event': 'start', 'total': total, 'channel_title': channel_title})}\n\n"

                for index, user_id in enumerate(user_ids, 1):
                    try:
                        user_target = self.cached_users.get(user_id)
                        if not user_target:
                            try:
                                user_target = await client.get_input_entity(user_id)
                            except Exception:
                                user_target = user_id

                        user_name = f"{getattr(user_target, 'first_name', '') or ''} {getattr(user_target, 'last_name', '') or ''}".strip() if hasattr(user_target, 'first_name') else str(user_id)
                        username = f"@{user_target.username}" if getattr(user_target, 'username', None) else ""

                        await client(HideChatJoinRequestRequest(
                            peer=entity,
                            user_id=user_target,
                            approved=True
                        ))

                        successful += 1
                        msg = f"[{index}/{total}] Approved: {user_name} {username} [ID: {user_id}]"
                        logger.info(msg)
                        yield f"data: {json.dumps({'event': 'progress', 'current': index, 'total': total, 'user_id': user_id, 'user_name': user_name, 'status': 'success', 'message': msg})}\n\n"

                    except errors.FloodWaitError as flood_err:
                        wait_seconds = flood_err.seconds
                        msg = f"Telegram FloodWait: Pausing for {wait_seconds}s before retrying user ID {user_id}..."
                        logger.warning(msg)
                        yield f"data: {json.dumps({'event': 'flood_wait', 'wait_seconds': wait_seconds, 'message': msg})}\n\n"
                        await asyncio.sleep(wait_seconds + 1)

                        try:
                            await client(HideChatJoinRequestRequest(
                                peer=entity,
                                user_id=user_target if 'user_target' in locals() else user_id,
                                approved=True
                            ))
                            successful += 1
                            msg = f"[{index}/{total}] (After wait) Approved user ID: {user_id}"
                            yield f"data: {json.dumps({'event': 'progress', 'current': index, 'total': total, 'user_id': user_id, 'status': 'success', 'message': msg})}\n\n"
                        except Exception as retry_err:
                            failed += 1
                            msg = f"[{index}/{total}] Failed to approve user ID {user_id}: {retry_err}"
                            yield f"data: {json.dumps({'event': 'progress', 'current': index, 'total': total, 'user_id': user_id, 'status': 'failed', 'message': msg})}\n\n"

                    except Exception as err:
                        failed += 1
                        msg = f"[{index}/{total}] Failed to approve user ID {user_id}: {str(err)}"
                        logger.error(msg)
                        yield f"data: {json.dumps({'event': 'progress', 'current': index, 'total': total, 'user_id': user_id, 'status': 'failed', 'message': msg})}\n\n"

                    await asyncio.sleep(delay)

                yield f"data: {json.dumps({'event': 'complete', 'successful': successful, 'failed': failed, 'total': total})}\n\n"
                return

            # MODE B: Continuous Full-Channel Turbo Clear (Approves 1000s in 1 Click)
            init_res = await client(GetChatInviteImportersRequest(
                peer=entity,
                requested=True,
                limit=1,
                offset_date=None,
                offset_user=InputUserEmpty()
            ))
            initial_count = getattr(init_res, 'count', len(init_res.importers))

            if not init_res.importers or initial_count == 0:
                yield f"data: {json.dumps({'event': 'complete', 'successful': 0, 'failed': 0, 'total': 0, 'message': 'No pending join requests in this channel.'})}\n\n"
                return

            yield f"data: {json.dumps({'event': 'start', 'total': initial_count, 'channel_title': channel_title})}\n\n"

            batch_num = 0
            max_batches = 300
            approved_total = 0
            last_remaining = initial_count

            while batch_num < max_batches:
                batch_num += 1

                try:
                    await client(HideAllChatJoinRequestsRequest(
                        peer=entity,
                        approved=True
                    ))
                except errors.FloodWaitError as flood_err:
                    wait_sec = flood_err.seconds
                    msg = f"Telegram FloodWait: Pausing for {wait_sec}s before continuing auto-approval..."
                    logger.warning(msg)
                    yield f"data: {json.dumps({'event': 'flood_wait', 'wait_seconds': wait_sec, 'message': msg})}\n\n"
                    await asyncio.sleep(wait_sec + 1)
                    continue

                # Check remaining requests
                check_res = await client(GetChatInviteImportersRequest(
                    peer=entity,
                    requested=True,
                    limit=1,
                    offset_date=None,
                    offset_user=InputUserEmpty()
                ))

                remaining = getattr(check_res, 'count', len(check_res.importers))
                
                # Check if completely finished
                if not check_res.importers or remaining == 0:
                    approved_total = initial_count
                    msg = f"[Batch #{batch_num}] All pending join requests cleared! Total approved: {approved_total}"
                    logger.info(msg)
                    yield f"data: {json.dumps({'event': 'progress', 'current': approved_total, 'total': approved_total, 'remaining': 0, 'status': 'success', 'message': msg})}\n\n"
                    successful = approved_total
                    break

                # Calculate progress
                if last_remaining > remaining:
                    cleared_this_batch = last_remaining - remaining
                else:
                    cleared_this_batch = 100

                approved_total += cleared_this_batch
                total_target = max(initial_count, approved_total + remaining)
                msg = f"[Batch #{batch_num}] Approved batch of join requests. Processed: ~{approved_total} / {total_target} ({remaining} remaining in queue)..."
                logger.info(msg)
                yield f"data: {json.dumps({'event': 'progress', 'current': approved_total, 'total': total_target, 'remaining': remaining, 'status': 'success', 'message': msg})}\n\n"

                # If HideAll isn't clearing a specific link, approve next 50 individually
                if remaining >= last_remaining and check_res.importers:
                    batch_importers_res = await client(GetChatInviteImportersRequest(
                        peer=entity,
                        requested=True,
                        limit=50,
                        offset_date=None,
                        offset_user=InputUserEmpty()
                    ))
                    for imp in batch_importers_res.importers:
                        try:
                            u_target = self.cached_users.get(imp.user_id) or imp.user_id
                            await client(HideChatJoinRequestRequest(
                                peer=entity,
                                user_id=u_target,
                                approved=True
                            ))
                        except Exception:
                            pass
                    await asyncio.sleep(0.3)

                last_remaining = remaining
                await asyncio.sleep(0.5)

            successful = approved_total if approved_total > 0 else initial_count
            yield f"data: {json.dumps({'event': 'complete', 'successful': successful, 'failed': 0, 'total': successful, 'message': f'All {successful} join requests approved successfully!'})}\n\n"

        except Exception as e:
            logger.error(f"Approval stream error: {e}", exc_info=True)
            yield f"data: {json.dumps({'event': 'error', 'message': f'Fatal error during approval: {str(e)}'})}\n\n"

    # =========================================================================
    # Auto-Pilot Background Worker
    # =========================================================================

    async def _autopilot_loop(self, channel_id: Any, interval_seconds: int = 30):
        logger.info(f"Auto-Pilot Join Request Approver started for channel {channel_id} (Interval: {interval_seconds}s)")
        client = self._get_client()

        while self.autopilot_active:
            try:
                self.autopilot_last_run = asyncio.get_event_loop().time()
                entity = await self._resolve_entity(channel_id)
                self.autopilot_channel_title = getattr(entity, 'title', str(channel_id))

                # Check if there are pending requests
                res = await client(GetChatInviteImportersRequest(
                    peer=entity,
                    requested=True,
                    limit=100,
                    offset_date=None,
                    offset_user=InputUserEmpty()
                ))

                pending_count = getattr(res, 'count', len(res.importers))
                if pending_count > 0:
                    logger.info(f"[Auto-Pilot] Found {pending_count} pending join requests.")
                    
                    # 1. Blacklist Sentinel Intercept
                    blacklist = load_blacklist()
                    blacklisted_ids = {b.get("id") for b in blacklist if b.get("id")}

                    if blacklisted_ids and res.importers:
                        for imp in res.importers:
                            if imp.user_id in blacklisted_ids:
                                try:
                                    logger.warning(f"[SENTINEL] Intercepted Blacklisted Bad Actor ID {imp.user_id}! Auto-rejecting and banning...")
                                    await client(HideChatJoinRequestRequest(peer=entity, user_id=imp.user_id, approved=False))
                                    if isinstance(entity, Channel):
                                        await client(EditBannedRequest(
                                             channel=entity,
                                             participant=imp.user_id,
                                             banned_rights=ChatBannedRights(until_date=None, view_messages=True, send_messages=True)
                                        ))
                                except Exception as sent_err:
                                    logger.error(f"[SENTINEL] Error banning blacklisted user: {sent_err}")

                    # 2. Auto-approve remaining requests
                    cycle_batches = 0
                    while cycle_batches < 50 and self.autopilot_active:
                        cycle_batches += 1
                        await client(HideAllChatJoinRequestsRequest(
                            peer=entity,
                            approved=True
                        ))

                        check_res = await client(GetChatInviteImportersRequest(
                            peer=entity,
                            requested=True,
                            limit=1,
                            offset_date=None,
                            offset_user=InputUserEmpty()
                        ))

                        if not check_res.importers or getattr(check_res, 'count', 0) == 0:
                            break

                        await asyncio.sleep(0.5)

                    self.autopilot_approved_count += pending_count
                    log_entry = f"[{asyncio.get_event_loop().time()}] Auto-approved {pending_count} join requests for {self.autopilot_channel_title}"
                    self.autopilot_logs.append(log_entry)
                    if len(self.autopilot_logs) > 50:
                        self.autopilot_logs.pop(0)
                    logger.info(log_entry)

            except errors.FloodWaitError as flood_err:
                logger.warning(f"[Auto-Pilot] FloodWait: Pausing for {flood_err.seconds}s")
                await asyncio.sleep(flood_err.seconds + 1)
            except Exception as e:
                logger.error(f"[Auto-Pilot] Error in loop: {e}")

            await asyncio.sleep(interval_seconds)

    def start_autopilot(self, channel_id: Any, interval_seconds: int = 30) -> Dict[str, Any]:
        if self.autopilot_active:
            self.stop_autopilot()

        self.autopilot_active = True
        self.autopilot_channel_id = channel_id
        self.autopilot_interval = interval_seconds
        self.autopilot_task = asyncio.create_task(self._autopilot_loop(channel_id, interval_seconds))

        return {
            "success": True,
            "message": f"Auto-Pilot started (Checking every {interval_seconds}s)",
            "channel_id": channel_id,
            "interval_seconds": interval_seconds
        }

    def stop_autopilot(self) -> Dict[str, Any]:
        if self.autopilot_task and not self.autopilot_task.done():
            self.autopilot_task.cancel()
        self.autopilot_active = False
        self.autopilot_task = None
        return {
            "success": True,
            "message": "Auto-Pilot stopped"
        }

    def get_autopilot_status(self) -> Dict[str, Any]:
        return {
            "is_active": self.autopilot_active,
            "channel_id": self.autopilot_channel_id,
            "channel_title": self.autopilot_channel_title,
            "approved_count": self.autopilot_approved_count,
            "interval_seconds": self.autopilot_interval,
            "last_run": self.autopilot_last_run,
            "recent_logs": self.autopilot_logs[-10:] if self.autopilot_logs else []
        }

    # =========================================================================
    # Global Ban & Total Digital Wipeout Engine
    # =========================================================================

    async def resolve_target_user(self, query: str) -> Dict[str, Any]:
        """Resolve a user by Telegram User ID, @username, or Phone and perform safety checks."""
        authorized = await self.ensure_connected()
        if not authorized:
            return {"success": False, "error": "Not logged in to Telegram"}

        clean_query = query.strip()
        if not clean_query:
            return {"success": False, "error": "Target username, User ID, or phone number cannot be empty."}

        client = self._get_client()
        try:
            me = await client.get_me()

            # Parse target identifier
            if clean_query.lstrip('-').isdigit():
                target_entity = await client.get_entity(int(clean_query))
            else:
                target_entity = await client.get_entity(clean_query)

            if not isinstance(target_entity, User):
                return {
                    "success": False,
                    "error": f"Target '{clean_query}' resolved to a {type(target_entity).__name__}, not a Telegram user profile."
                }

            # Safety Guard 1: Prevent targeting oneself
            if target_entity.id == me.id:
                return {
                    "success": False,
                    "error": "Safety Protection Alert: You cannot target your own connected Telegram account!"
                }

            # Safety Guard 2: Telegram Official Service accounts
            if target_entity.id in (777000, 42777, 333000):
                return {
                    "success": False,
                    "error": "Safety Protection Alert: Telegram Official Notification service accounts are protected."
                }

            self.cached_users[target_entity.id] = target_entity
            full_name = f"{getattr(target_entity, 'first_name', '') or ''} {getattr(target_entity, 'last_name', '') or ''}".strip() or "Telegram User"

            return {
                "success": True,
                "user": {
                    "id": target_entity.id,
                    "first_name": target_entity.first_name or "",
                    "last_name": target_entity.last_name or "",
                    "name": full_name,
                    "username": target_entity.username or "",
                    "phone": target_entity.phone or "",
                    "is_bot": bool(target_entity.bot),
                    "is_verified": bool(getattr(target_entity, 'verified', False)),
                    "is_premium": bool(getattr(target_entity, 'premium', False))
                }
            }
        except Exception as e:
            logger.error(f"Failed to resolve target user '{query}': {e}")
            return {"success": False, "error": f"Target user not found: {str(e)}"}

    async def nuke_user_stream(self, target_query: str, options: Dict[str, Any]) -> AsyncGenerator[str, None]:
        """Execute systematic multi-layer digital wipeout with real-time SSE progress."""
        authorized = await self.ensure_connected()
        if not authorized:
            yield f"data: {json.dumps({'event': 'error', 'message': 'Not authorized in Telegram'})}\n\n"
            return

        client = self._get_client()
        res = await self.resolve_target_user(target_query)
        if not res.get("success"):
            yield f"data: {json.dumps({'event': 'error', 'message': res.get('error', 'Target not found')})}\n\n"
            return

        target_user = res["user"]
        target_id = target_user["id"]
        target_name = target_user["name"]
        target_uname = f"@{target_user['username']}" if target_user["username"] else f"[ID: {target_id}]"

        ban_from_chats = options.get("ban_from_chats", True)
        purge_messages = options.get("purge_messages", True)
        wipe_private_chat = options.get("wipe_private_chat", True)
        block_contact = options.get("block_contact", True)
        rotate_invite_links = options.get("rotate_invite_links", False)
        add_to_bl = options.get("add_to_blacklist", True)

        target_entity = self.cached_users.get(target_id) or await client.get_input_entity(target_id)

        # Discover all dialogs where user is Owner OR Admin
        admin_dialogs = []
        try:
            async for dialog in client.iter_dialogs():
                entity = dialog.entity
                if isinstance(entity, Channel):
                    is_admin = bool(entity.admin_rights or entity.creator)
                    if is_admin:
                        admin_dialogs.append(entity)
                elif isinstance(entity, Chat):
                    is_admin = bool(getattr(entity, 'admin_rights', None) or getattr(entity, 'creator', False))
                    if is_admin:
                        admin_dialogs.append(entity)
        except Exception as d_err:
            logger.warning(f"Error iterating dialogs for wipeout: {d_err}")

        total_chats = len(admin_dialogs)
        total_steps = (total_chats if ban_from_chats else 0) + (1 if wipe_private_chat else 0) + (1 if block_contact else 0) + (1 if add_to_bl else 0)
        total_steps = max(1, total_steps)
        current_step = 0
        chats_banned_count = 0
        messages_purged_count = 0
        links_rotated_count = 0

        yield f"data: {json.dumps({'event': 'start', 'total': total_steps, 'target_id': target_id, 'target_name': target_name, 'target_username': target_uname, 'total_chats': total_chats})}\n\n"

        # Phase 1: 2-Way Direct Message Wipeout (Revoke=True)
        if wipe_private_chat:
            current_step += 1
            try:
                await client(DeleteHistoryRequest(
                    peer=target_entity,
                    max_id=0,
                    just_clear=False,
                    revoke=True
                ))
                msg = f"[WIPED] 2-Way erased private conversation history for both parties (revoke=True)."
                logger.info(msg)
                yield f"data: {json.dumps({'event': 'progress', 'current': current_step, 'total': total_steps, 'status': 'success', 'message': msg})}\n\n"
            except Exception as e:
                msg = f"[DM] Private chat wipe notice: {e}"
                yield f"data: {json.dumps({'event': 'progress', 'current': current_step, 'total': total_steps, 'status': 'info', 'message': msg})}\n\n"
            await asyncio.sleep(0.3)

        # Phase 2: Block on Personal Telegram Account & Delete Contacts
        if block_contact:
            current_step += 1
            try:
                await client(BlockRequest(id=target_entity))
                try:
                    await client(DeleteContactsRequest(id=[target_entity]))
                except Exception:
                    pass
                msg = f"[BLOCKED] Target {target_name} blocked on personal Telegram account & contact severed."
                logger.info(msg)
                yield f"data: {json.dumps({'event': 'progress', 'current': current_step, 'total': total_steps, 'status': 'success', 'message': msg})}\n\n"
            except Exception as e:
                msg = f"[BLOCK] Personal contact block error: {e}"
                yield f"data: {json.dumps({'event': 'progress', 'current': current_step, 'total': total_steps, 'status': 'warning', 'message': msg})}\n\n"
            await asyncio.sleep(0.3)

        # Phase 3: Global Multi-Channel & Group Exclusion (All Owned & Admin Chats)
        if ban_from_chats:
            banned_rights = ChatBannedRights(
                until_date=None,
                view_messages=True,
                send_messages=True,
                send_media=True,
                send_stickers=True,
                send_gifs=True,
                send_games=True,
                send_inline=True,
                embed_links=True,
                send_polls=True,
                change_info=True,
                invite_users=True,
                pin_messages=True
            )

            for index, chat in enumerate(admin_dialogs, 1):
                current_step += 1
                chat_title = getattr(chat, 'title', f"Chat {chat.id}")
                chat_type = "Channel" if isinstance(chat, Channel) and chat.broadcast else ("Supergroup" if isinstance(chat, Channel) else "Group")

                try:
                    if isinstance(chat, Channel):
                        # Permanent Ban
                        await client(EditBannedRequest(
                            channel=chat,
                            participant=target_entity,
                            banned_rights=banned_rights
                        ))
                        chats_banned_count += 1

                        # Purge message history
                        if purge_messages:
                            try:
                                await client(DeleteParticipantHistoryRequest(
                                    channel=chat,
                                    participant=target_entity
                                ))
                                messages_purged_count += 1
                            except Exception as p_err:
                                logger.debug(f"Could not purge messages in {chat_title}: {p_err}")

                        # Rotate primary invite link if Creator
                        if rotate_invite_links and getattr(chat, 'creator', False):
                            try:
                                await client(ExportChatInviteRequest(
                                    peer=chat,
                                    title="Auto-Rotated Primary Link",
                                    request_needed=True
                                ))
                                links_rotated_count += 1
                            except Exception:
                                pass

                        msg = f"[{current_step}/{total_steps}] [BANNED] Permanently excluded from [{chat_type}] '{chat_title}'"
                        if purge_messages:
                            msg += " + message history vaporized."
                        yield f"data: {json.dumps({'event': 'progress', 'current': current_step, 'total': total_steps, 'status': 'success', 'message': msg})}\n\n"

                    elif isinstance(chat, Chat):
                        await client(DeleteChatUserRequest(
                            chat_id=chat.id,
                            user_id=target_id
                        ))
                        chats_banned_count += 1
                        msg = f"[{current_step}/{total_steps}] [KICKED] Removed from [{chat_type}] '{chat_title}'"
                        yield f"data: {json.dumps({'event': 'progress', 'current': current_step, 'total': total_steps, 'status': 'success', 'message': msg})}\n\n"

                except errors.FloodWaitError as f_err:
                    wait_s = f_err.seconds
                    msg = f"Telegram FloodWait: Pausing for {wait_s}s before continuing wipeout..."
                    yield f"data: {json.dumps({'event': 'flood_wait', 'wait_seconds': wait_s, 'message': msg})}\n\n"
                    await asyncio.sleep(wait_s + 1)
                    try:
                        if isinstance(chat, Channel):
                            await client(EditBannedRequest(channel=chat, participant=target_entity, banned_rights=banned_rights))
                            chats_banned_count += 1
                    except Exception:
                        pass
                except Exception as chat_err:
                    msg = f"[{current_step}/{total_steps}] [SKIPPED] '{chat_title}': {str(chat_err)}"
                    yield f"data: {json.dumps({'event': 'progress', 'current': current_step, 'total': total_steps, 'status': 'info', 'message': msg})}\n\n"

                await asyncio.sleep(0.15)

        # Phase 4: Add to Persistent Blacklist Sentinel
        if add_to_bl:
            current_step += 1
            self.add_to_blacklist({
                "id": target_id,
                "name": target_name,
                "username": target_user["username"],
                "phone": target_user["phone"],
                "reason": options.get("reason", "Harassment / Bad Actor Nuke"),
                "chats_banned_count": chats_banned_count
            })
            msg = f"[BLACKLISTED] Target added to permanent Auto-Pilot Sentinel database."
            logger.info(msg)
            yield f"data: {json.dumps({'event': 'progress', 'current': current_step, 'total': total_steps, 'status': 'success', 'message': msg})}\n\n"

        # Phase 5: Final Summary Complete
        summary_msg = f"[SUCCESS] Total Digital Wipeout Complete! Target {target_name} ({target_uname}) banned from {chats_banned_count} owned/admin chats, private DM wiped, personal contact blocked, and registered in Blacklist Sentinel."
        yield f"data: {json.dumps({'event': 'complete', 'successful': chats_banned_count, 'chats_banned': chats_banned_count, 'messages_purged': messages_purged_count, 'links_rotated': links_rotated_count, 'total': total_steps, 'message': summary_msg})}\n\n"


tg_manager = TelegramManager()


