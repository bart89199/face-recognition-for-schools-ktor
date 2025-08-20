package com.batr

import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.auth.*
import io.ktor.server.http.content.*
import io.ktor.server.plugins.*
import io.ktor.server.plugins.statuspages.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import java.io.File

fun Application.configureRouting() {
    install(StatusPages) {
        exception<Throwable> { call, cause ->
            call.respondText(text = "500: $cause", status = HttpStatusCode.InternalServerError)
        }
    }

    routing {
        authenticate("session-auth") {
            get {
                call.respondFile(getResource("react-app/index.html")!!)
            }
            singlePageApplication {
                this.applicationRoute = "/assets"
                this.useResources = true
                react("react-app")
            }
        }

    }
}

suspend inline fun <reified T : Any> ApplicationCall.receiveOrRespond(
    respondStatus: HttpStatusCode = HttpStatusCode.BadRequest,
    message: String = "incorrect json"
): T? = try {
    receive<T>()
} catch (_: BadRequestException) {
    respond(respondStatus, message)
    null
} catch (_: CannotTransformContentToTypeException) {
    respond(respondStatus, message)
    null
}

fun Application.getResource(path: String) = environment.classLoader.getResource(path)?.file?.let { File(it) }