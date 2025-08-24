package com.batr.auth.session

import com.batr.auth.getSession
import com.batr.auth.setPermissions
import com.batr.auth.user.UserPermissions
import com.batr.auth.user.UserService
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
                    val res = SessionService.deleteByUserId(session.userId)
                    call.respond(HttpStatusCode.OK, res)
                }
                delete("/{id}") {
                    val session = call.getSession() ?: return@delete
                    val id = call.parameters["id"]?.toIntOrNull()
                    if (id == null) {
                        call.respond(HttpStatusCode.Companion.BadRequest, "can't read id")
                        return@delete
                    }
                    val aim = SessionService.getById(id)
                    if (aim == null) {
                        call.respond(HttpStatusCode.NotFound)
                        return@delete
                    }

                    if (aim.userId != session.userId) {
                        call.respond(HttpStatusCode.BadRequest, "incorrect id")
                        return@delete
                    }
                    SessionService.deleteById(id)
                    call.respond(HttpStatusCode.OK)
                }
            }
            setPermissions(UserPermissions(admin = true)) {
                route("/auth/manage/user/{id}/sessions") {
                    get {
                        val id = call.parameters["id"]?.toIntOrNull()
                        if (id == null) {
                            call.respond(HttpStatusCode.Companion.BadRequest, "can't read id")
                            return@get
                        }
                        val active = call.queryParameters["active"]?.toBoolean()
                        val user = UserService.getById(id)
                        if (user == null) {
                            call.respond(HttpStatusCode.Companion.NotFound)
                            return@get
                        }
                        val sessions = user.getAllSessions(active).map { it.toRaw() }
                        call.respond(sessions)
                    }
                    delete {
                        val id = call.parameters["id"]?.toIntOrNull()
                        if (id == null) {
                            call.respond(HttpStatusCode.Companion.BadRequest, "can't read id")
                            return@delete
                        }
                        val res = SessionService.deleteByUserId(id)
                        call.respond(HttpStatusCode.OK, res)
                    }
                }
                route("/auth/manage/session") {
                    get {
                        val active = call.queryParameters["active"]?.toBoolean()
                        val sessions = SessionService.getAll(active).map { it.toRaw() }
                        call.respond(sessions)
                    }
                    delete {
                        val res = SessionService.deleteAll()
                        call.respond(HttpStatusCode.OK, res)
                    }
                    get("/{id}") {
                        val id = call.parameters["id"]?.toIntOrNull()
                        if (id == null) {
                            call.respond(HttpStatusCode.Companion.BadRequest, "can't read id")
                            return@get
                        }
                        val session = SessionService.getById(id)?.toRaw()
                        if (session == null) {
                            call.respond(HttpStatusCode.Companion.NotFound)
                            return@get
                        }
                        call.respond(session)
                    }
                    delete("/{id}") {
                        val id = call.parameters["id"]?.toIntOrNull()
                        if (id == null) {
                            call.respond(HttpStatusCode.Companion.BadRequest, "can't read id")
                            return@delete
                        }
                        val status = SessionService.deleteById(id)
                        if (!status) {
                            call.respond(HttpStatusCode.Companion.NotFound)
                            return@delete
                        }
                        call.respond(HttpStatusCode.OK)
                    }
                }
            }
        }
    }
}

@Serializable
data class RawSession(
    val id: Int,
    val active: Boolean,
    val expiresAt: Long,
    val requestData: RequestData,
    val googleLogin: Boolean,
)

fun UserSession.toRaw() = RawSession(id, active, expiresAt, requestData, googleAccess != null)