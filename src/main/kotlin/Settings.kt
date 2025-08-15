package com.batr

import io.ktor.http.HttpStatusCode
import io.ktor.server.application.Application
import io.ktor.server.request.receive
import io.ktor.server.response.respond
import io.ktor.server.routing.get
import io.ktor.server.routing.put
import io.ktor.server.routing.route
import io.ktor.server.routing.routing
import kotlinx.serialization.Serializable

@Serializable
data class Setting(
    val name: String,
    var value: String,
    val comment: String,
)

@Serializable
data class SettingUpdate(val name: String, val value: String)

private var settings = listOf(
    Setting("lol", "a", "aad"),
    Setting("t435", "34мыв3", "11"),
    Setting("fgdgfvxc", "vbcvvvsdg", "ФМРУЫГРПНУПАИ"),
)

fun Application.configureSettings() {
    routing {
        route("/api/settings") {
            get {
                call.respond(settings)
            }
            put {
                val upd = call.receive<SettingUpdate>()
                for (s in settings) {
                    if (s.name == upd.name) {
                        s.value = upd.value
                        call.respond(HttpStatusCode.NoContent)
                        return@put
                    }
                }
                call.respond(HttpStatusCode.NotFound)
            }
        }
    }
}