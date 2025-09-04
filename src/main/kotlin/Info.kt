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
import io.ktor.server.websocket.webSocket
import io.ktor.websocket.Frame
import io.ktor.websocket.readText
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json


fun Application.configureInfo() {
    routing {
        get ("/api/door") {
            call.respond(PythonConnection.systemStatus?.door.toString())
        }
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
                    webSocket("/ws") {
                        val statusJob: Job = launch {
                            while (true) {
                                PythonConnection.systemStatus?.let { status ->
                                    outgoing.send(Frame.Text(Json.encodeToString(status)))
                                }
                                delay(200)
                            }
                        }

                        try {
                            for (frame in incoming) {
                                when (frame) {
                                    is Frame.Ping -> {
                                    }
                                    is Frame.Pong -> {
                                    }
                                    is Frame.Close -> {
                                        break
                                    }
                                    else -> {

                                    }
                                }
                            }
                        } catch (_: Throwable) {
                        } finally {
                            statusJob.cancel()
                        }
                    }
                }
            }
        }
    }
}