package com.batr.log.system

import com.batr.auth.setPermissions
import com.batr.auth.user.UserPermissions
import io.ktor.server.application.Application
import io.ktor.server.auth.authenticate
import io.ktor.server.response.respond
import io.ktor.server.routing.get
import io.ktor.server.routing.route
import io.ktor.server.routing.routing

fun Application.configureSystemLogManager() {
    routing {
        authenticate("session-auth") {
            setPermissions(UserPermissions(logs = true)) {
                route("api/logs/system") {
                    get {
                        val start = call.queryParameters["start"]?.toLong()
                        val end = call.queryParameters["end"]?.toLong()
                        val type = try {
                            call.queryParameters["type"]?.split(",")?.map { SystemLogType.valueOf(it) } ?: emptyList()
                        } catch (e: Throwable) {
                            e.printStackTrace()
                            emptyList()
                        }
                        val logs = SystemLogService.getLogs(type = type, start = start, end = end)
                        call.respond(logs)
                    }
                    get("new") {
                        val type = SystemLogType.valueOf(call.parameters["type"] ?: "")
                        val message = call.parameters["message"] ?: ""
                        SystemLogService.log(type, message)
                    }
                }
            }
        }
    }
}