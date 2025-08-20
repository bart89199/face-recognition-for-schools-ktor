package com.batr

import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.auth.*
import io.ktor.server.http.content.*
import io.ktor.server.plugins.BadRequestException
import io.ktor.server.plugins.CannotTransformContentToTypeException
import io.ktor.server.plugins.statuspages.*
import io.ktor.server.request.receive
import io.ktor.server.response.*
import io.ktor.server.routing.*

fun Application.configureRouting() {
    install(StatusPages) {
        exception<Throwable> { call, cause ->
            call.respondText(text = "500: $cause", status = HttpStatusCode.InternalServerError)
        }
    }

    routing {
        authenticate("session-auth") {
            singlePageApplication {
                this.defaultPage = "index.html"
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
} catch (ex: BadRequestException) {
    respond(respondStatus, message)
    null
} catch (ex: CannotTransformContentToTypeException) {
    respond(respondStatus, message)
    null
}
