package com.batr

import com.batr.auth.PasswordHasher
import com.batr.auth.getSession
import com.batr.auth.session.getUser
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.Application
import io.ktor.server.auth.authenticate
import io.ktor.server.plugins.origin
import io.ktor.server.request.host
import io.ktor.server.request.receive
import io.ktor.server.response.respond
import io.ktor.server.response.respondText
import io.ktor.server.routing.get
import io.ktor.server.routing.post
import io.ktor.server.routing.route
import io.ktor.server.routing.routing
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import java.net.InetAddress

@Serializable
data class Password(val password: String)

fun Application.configureTest() {
    routing {
        authenticate("session-auth", optional = false) {
            get("/test") {
                val session = call.getSession()
                if (session != null) {
                    val user = session.getUser()
                    call.respondText("Hello, ${user.name}! $")
                }
            }
        }

        get("/info") {
            val directIp = call.request.origin.remoteAddress
            val forwardedFor = call.request.headers["X-Forwarded-For"]?.split(",")?.firstOrNull()?.trim()
            val realIp = call.request.headers["X-Real-IP"]
            val effectiveIp = forwardedFor ?: realIp ?: directIp

            // Обратный DNS (опционально, может тормозить)
            val reverseHost = withContext(Dispatchers.IO) {
                try {
                    InetAddress.getByName(effectiveIp).hostName
                } catch (_: Exception) {
                    effectiveIp
                }
            }

            val userAgent = call.request.headers["User-Agent"]
            val hostHeader = call.request.host()

            call.respondText(
                """
                    directIp = $directIp
                    forwardedFor(first) = $forwardedFor
                    realIp = $realIp
                    effectiveIp = $effectiveIp
                    reverseHost = $reverseHost
                    hostHeader(target host) = $hostHeader
                    userAgent = $userAgent
                    """.trimIndent()
            )
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