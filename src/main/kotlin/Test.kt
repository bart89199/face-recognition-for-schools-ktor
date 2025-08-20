package com.batr

import com.batr.auth.PasswordHasher
import com.batr.auth.getSessionOrRedirect
import com.batr.auth.session.getUser
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.Application
import io.ktor.server.auth.authenticate
import io.ktor.server.request.receive
import io.ktor.server.response.respond
import io.ktor.server.response.respondText
import io.ktor.server.routing.get
import io.ktor.server.routing.post
import io.ktor.server.routing.route
import io.ktor.server.routing.routing
import kotlinx.serialization.Serializable

@Serializable
data class Password(val password: String)

fun Application.configureTest() {
    routing {
        authenticate("session-auth", optional = false) {
            get("/test") {
                val session = call.getSessionOrRedirect()
                if (session != null) {
                    val user = session.getUser()
                    call.respondText("Hello, ${user.name}! $")
                }
            }
        }


        route("/test") {
            post("/auth") {
                val password = call.receive<Password>().password
                val hash = PasswordHasher.hash(password).result
                if (PasswordHasher.verify(password, hash)) {
                    call.respond(HttpStatusCode.OK)
                } else {
                    call.respond(HttpStatusCode.BadRequest)
                }
            }
        }
    }
}