package com.batr.auth.session

import com.batr.auth.getSession
import com.batr.auth.setPermissions
import com.batr.auth.user.UserPermissions
import com.batr.auth.user.UserService
import com.batr.auth.user.toNoPass
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.*
import io.ktor.server.auth.*
import io.ktor.server.response.respond
import io.ktor.server.routing.*
import kotlinx.serialization.Serializable

fun Application.configureSessionManagement() {
    routing {
        authenticate("session-auth") {
            route("/api/user/sessions") {
                get {
                    val session = call.getSession() ?: return@get
                    val sessions = session.getAllSessions().map { it.toRaw() }
                    call.respond(sessions)
                }
                get("/current") {
                    val session = call.getSession()?.toRaw() ?: return@get
                    call.respond(session)
                }
                delete {
                    val session = call.getSession() ?: return@delete
                    SessionService.removeAllUserSessions(session.userId)
                    call.respond(HttpStatusCode.NoContent)
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
                    call.respond(HttpStatusCode.NoContent)
                }
            }
            setPermissions(UserPermissions(admin = true)) {
                route("/auth/manage/session") {
                    get {
                        val sessions = SessionService.getAll().map { it.toRaw() }
                        call.respond(sessions)
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
                        call.respond(HttpStatusCode.NoContent)
                    }
                }
            }
        }
    }
}

@Serializable
data class RawSession(
    val expiresAt: Long,
    val requestData: RequestData,
    val googleLogin: Boolean,
)

fun UserSession.toRaw() = RawSession(expiresAt, requestData, googleAccess != null)