package com.batr

import io.ktor.server.application.Application
import io.ktor.server.response.respond
import io.ktor.server.routing.get
import io.ktor.server.routing.route
import io.ktor.server.routing.routing
import kotlinx.serialization.Serializable

@Serializable
data class DetectionStatus(
    var status: String,
)

fun Application.configureInfo() {
    routing {
        route("/api/logs") {
            get("/current") {
                val logs = listOf(
                    "2025-08-15 12:42:52.020 [main] INFO  Application - Using embedded H2 database for testing; replace this flag to use postgres",
                    "2025-08-15 12:42:52.811 [main] INFO  Application - Application started in 2.75 seconds."
                )
                call.respond(logs)
            }
        }

        route("/api/detection-status") {
            get {
                call.respond(DetectionStatus("OK"))
            }
        }
    }
}