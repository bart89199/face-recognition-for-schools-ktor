package com.batr.auth.session

import com.batr.auth.getSession
import com.batr.auth.setPermissions
import com.batr.auth.user.UserPermissions
import com.batr.auth.user.UserService
import com.batr.fetchQueryInts
import com.batr.log.AdminLogType
import com.batr.log.log
import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.auth.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import kotlinx.serialization.Serializable

fun Application.configureSessionManagement() {
    routing {
        authenticate("session-auth") {
            route("/api/user/sessions") {
                get {
                    val session = call.getSession() ?: return@get
                    val sessions = session.getAllUserSessions(true).map { it.toRaw() }
                    call.respond(sessions)
                }

                get("/all") {
                    val session = call.getSession() ?: return@get
                    val sessions = session.getAllUserSessions(null).map { it.toRaw() }
                    call.respond(sessions)
                }

                get("/not-active") {
                    val session = call.getSession() ?: return@get
                    val sessions = session.getAllUserSessions(false).map { it.toRaw() }
                    call.respond(sessions)
                }

                get("/current") {
                    val session = call.getSession()?.toRaw() ?: return@get
                    call.respond(session)
                }

                delete {
                    val session = call.getSession() ?: return@delete
                    val ids = fetchQueryInts("id") ?: return@delete
                    if (ids.isEmpty()) {
                        session.log(
                            AdminLogType.SESSION_DELETE,
                            "delete all own sessions: [${
                                session.getAllUserSessions(true).joinToString { it.id.toString() }
                            }]"
                        )
                        val res = SessionService.deleteByUserId(session.userId)
                        call.respond(HttpStatusCode.OK, res)
                        return@delete
                    }

                    val aim = SessionService.getByIds(ids)
                    if (aim.isEmpty()) {
                        call.respond(HttpStatusCode.NotFound)
                        return@delete
                    }

                    if (aim.any { it.userId != session.userId }) {
                        call.respond(HttpStatusCode.BadRequest, "incorrect id")
                        return@delete
                    }
                    session.log(AdminLogType.SESSION_DELETE, "delete own sessions: ${ids.joinToString()}")
                    SessionService.deleteByIds(ids)
                    call.respond(HttpStatusCode.OK)
                }
            }
            setPermissions(UserPermissions(admin = true)) {
                route("/api/manage/session") {
                    get {
                        val ids = fetchQueryInts("id") ?: return@get
                        if (ids.isEmpty()) {
                            val active = call.queryParameters["active"]?.toBoolean()
                            val sessions = SessionService.getAll(active).map { it.toRaw() }
                            call.respond(sessions)
                            return@get
                        }
                        val session = SessionService.getByIds(ids).map { it.toRaw() }
                        if (session.isEmpty()) {
                            call.respond(HttpStatusCode.NotFound)
                            return@get
                        }
                        call.respond(session)
                    }
                    delete {
                        val session = call.getSession() ?: return@delete
                        val ids = fetchQueryInts("id") ?: return@delete
                        if (ids.isEmpty()) {
                            session.log(
                                AdminLogType.SESSION_DELETE,
                                "delete all sessions: [${SessionService.getAll(true).joinToString { it.id.toString() }}]"
                            )
                            val res = SessionService.deleteAll()
                            call.respond(HttpStatusCode.OK, res)
                            return@delete
                        }
                        val status = SessionService.deleteByIds(ids)
                        if (status == 0) {
                            call.respond(HttpStatusCode.NotFound)
                            return@delete
                        }
                        session.log(AdminLogType.SESSION_DELETE, "delete sessions: ${ids.joinToString()}")
                        call.respond(HttpStatusCode.OK, status)
                    }
                    route("/byUserId") {
                        get {
                            val userIds = fetchQueryInts("id") ?: return@get
                            if (userIds.isEmpty()) {
                                call.respond(HttpStatusCode.BadRequest, "id is required")
                                return@get
                            }
                            val active = call.queryParameters["active"]?.toBoolean()

                            val sessions = SessionService.getUsersSessions(userIds, active).map { it.toRaw() }
                            call.respond(sessions)
                        }
                        delete {
                            val session = call.getSession() ?: return@delete
                            val userIds = fetchQueryInts("id") ?: return@delete
                            if (userIds.isEmpty()) {
                                call.respond(HttpStatusCode.BadRequest, "id is required")
                                return@delete
                            }
                            userIds.forEach { userId ->
                                session.log(
                                    AdminLogType.SESSION_DELETE,
                                    "delete all sessions of user: $userId [${
                                        SessionService.getUserSessions(userId, true).joinToString { it.id.toString() }
                                    }]"
                                )
                            }
                            val res = SessionService.deleteByUsersId(userIds)
                            call.respond(HttpStatusCode.OK, res)
                        }
                    }
                }
            }
        }
    }
}


@Serializable
data class RawSession(
    val id: Int,
    val userId: Int,
    val active: Boolean,
    val expiresAt: Long,
    val requestData: RequestData,
    val googleLogin: Boolean,
)

fun UserSession.toRaw() = RawSession(
    id = id,
    userId = userId,
    active = active,
    expiresAt = expiresAt,
    requestData = requestData,
    googleLogin = googleAccess != null
)