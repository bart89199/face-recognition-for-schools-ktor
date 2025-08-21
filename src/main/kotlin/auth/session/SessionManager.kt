package com.batr.auth.session

import com.batr.auth.getSession
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
        }
    }
}

@Serializable
data class RawSession(
    val id: Int,
    val expiresAt: Long,
    val requestData: RequestData,
    val googleLogin: Boolean,
)

fun UserSession.toRaw() = RawSession(id, expiresAt, requestData, googleAccess != null)