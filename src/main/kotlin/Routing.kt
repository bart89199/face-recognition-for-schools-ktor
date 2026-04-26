package com.batr

import com.batr.auth.getSession
import com.batr.auth.setPermissions
import com.batr.auth.user.UserPermissions
import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.auth.*
import io.ktor.server.http.content.*
import io.ktor.server.plugins.*
import io.ktor.server.plugins.defaultheaders.*
import io.ktor.server.plugins.partialcontent.*
import io.ktor.server.plugins.statuspages.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*

fun Application.configureRouting() {
    install(StatusPages) {
        exception<Throwable> { call, cause ->
            cause.printStackTrace()
            println(cause.message)
            call.respondText(text = "500: $cause", status = HttpStatusCode.InternalServerError)
        }
    }

    install(DefaultHeaders) {
        header("X-Engine", "Ktor") // will send this header with each response
    }

    install(PartialContent)

//    install(CallLogging) {
//        level = Level.INFO // Set the desired log level
//        format { call -> // Customize the log message format
//                val status = call.response.status()
//                val httpMethod = call.request.httpMethod.value
//                val userAgent = call.request.headers["User-Agent"]
//                "Status: $status, HTTP method: $httpMethod, User agent: $userAgent, Request path: ${call.request.path()}"
//
//        }
//        // Optional: filter requests (e.g., only log requests starting with /api/v1)
//        // filter { call ->
//        //     call.request.path().startsWith("/api/v1")
//        // }
//    }

    routing {
        get {
            val session = call.getSession(false)
            if (session?.active != true) {
                call.respondBytes(
                    call.application.environment.classLoader.getResource("login-old/index.html")!!.readBytes(),
                    ContentType.Text.Html
                )
                return@get
            }
            call.respondBytes(
                call.application.environment.classLoader.getResource("main-page/index.html")!!.readBytes(),
                ContentType.Text.Html
            )
        }
        authenticate("session-auth") {

            staticResources("/main-page", "main-page")

            setPermissions(UserPermissions(admin = true)) {
                staticResources("/admin", "admin")
            }


            setPermissions(UserPermissions(logs = true)) {
                staticResources("/logs", "logs")
            }

            setPermissions(UserPermissions(settings = true)) {
                staticResources("/settings", "settings")
            }

            setPermissions(UserPermissions(records = true)) {
                staticResources("/records", "records")
            }

            setPermissions(UserPermissions(status = true)) {
                staticResources("/status", "status")
            }

            staticResources("/profile", "profile")
        }

    }
}

suspend inline fun <reified T : Any> ApplicationCall.receiveOrRespond(
    respondStatus: HttpStatusCode = HttpStatusCode.BadRequest,
    message: String = "incorrect json"
): T? = try {
    receive<T>()
} catch (e: BadRequestException) {
    respond(respondStatus, e.message ?: message)
    null
} catch (e: CannotTransformContentToTypeException) {
    respond(respondStatus, e.message ?: message)
    null
}

suspend fun RoutingContext.fetchQueryInts(queryParameter: String): List<Int>? = try {
    call.request.queryParameters[queryParameter]?.split(",")?.map { it.toInt() } ?: emptyList()
} catch (_: NumberFormatException) {
    call.respond(HttpStatusCode.BadRequest, "Invalid id")
    null
}

fun RoutingContext.fetchQueryStrings(queryParameter: String): List<String> =
    call.request.queryParameters[queryParameter]?.split(",") ?: emptyList()