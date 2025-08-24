package com.batr

import io.ktor.http.HttpStatusCode
import io.ktor.server.application.Application
import io.ktor.server.request.receive
import io.ktor.server.response.respond
import io.ktor.server.routing.get
import io.ktor.server.routing.post
import io.ktor.server.routing.route
import io.ktor.server.routing.routing
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.SerializationException

@Serializable
data class DoorStatus(
    @SerialName("is_open") var isOpen: Boolean
)

private var doorStatus = DoorStatus(false)

fun Application.configureDoor() {
    routing {
        route("/api/door-status") {
            get {
                call.respond(doorStatus)
            }
            post {
                try {
                    val newStatus = call.receive<DoorStatus>()
                    doorStatus = newStatus
                    call.respond(HttpStatusCode.NoContent)
                } catch (_: IllegalStateException) {
                    call.respond(HttpStatusCode.BadRequest)
                } catch (_: SerializationException) {
                    call.respond(HttpStatusCode.BadRequest)
                }
            }
        }
    }
}