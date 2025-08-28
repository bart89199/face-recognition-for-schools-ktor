package com.batr

import com.batr.auth.setPermissions
import com.batr.auth.user.UserPermissions
import com.batr.pythonConnection.PythonConnection
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.Application
import io.ktor.server.auth.authenticate
import io.ktor.server.response.respond
import io.ktor.server.routing.get
import io.ktor.server.routing.route
import io.ktor.server.routing.routing
import kotlinx.serialization.Serializable


fun Application.configureInfo() {
    routing {
        authenticate("session-auth") {

            setPermissions(UserPermissions(status = true)) {
                route("/api/status") {
                    get {
                        val status = PythonConnection.systemStatus
                        if (status == null) {
                            call.respond(HttpStatusCode.NoContent)
                            return@get
                        }
                        call.respond(status)
                    }
                }
            }
        }
    }
}