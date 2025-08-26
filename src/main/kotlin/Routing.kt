package com.batr

import com.batr.auth.setPermissions
import com.batr.auth.user.UserPermissions
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
            cause.printStackTrace()
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

            setPermissions(UserPermissions(admin = true)) {
                staticResources("/admin", "admin")
            }

            setPermissions(UserPermissions(logs = true)) {
                staticResources("/logs", "logs")
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
} catch (_: BadRequestException) {
    respond(respondStatus, message)
    null
} catch (_: CannotTransformContentToTypeException) {
    respond(respondStatus, message)
    null
}

fun Application.getResource(path: String) = environment.classLoader.getResource(path)?.file?.let { File(it) }
suspend fun RoutingContext.fetchQueryInts(queryParameter: String): List<Int>? = try {
    call.request.queryParameters[queryParameter]?.split(",")?.map { it.toInt() } ?: emptyList()
} catch (_: NumberFormatException) {
    call.respond(HttpStatusCode.BadRequest, "Invalid id")
    null
}

fun RoutingContext.fetchQueryStrings(queryParameter: String): List<String> =
    call.request.queryParameters[queryParameter]?.split(",") ?: emptyList()