package com.batr.auth.user

import com.batr.receiveOrRespond
import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import kotlinx.serialization.Serializable

@Serializable
data class UserUpdate(
    val name: String? = null,
    val email: String? = null,
    val password: String? = null,
    val permissions: UserPermissions? = null,
)


fun Application.configureUserManagement() {
    routing {
        route("/auth/manage") {
            post {
                val newUser = call.receiveOrRespond<RawUser>() ?: return@post
                val id = UserService.createUser(newUser)
                if (id != -1) {
                    call.respond(HttpStatusCode.Companion.OK, id)
                } else {
                    call.respond(
                        HttpStatusCode.Companion.BadRequest,
                        "can't create user, email already exists or something wrong with db"
                    )
                }

            }
            put("/{id}") {
                val id = call.parameters["id"]?.toIntOrNull()
                if (id == null) {
                    call.respond(HttpStatusCode.Companion.BadRequest, "can't read id")
                    return@put
                }
                val userUpdate = call.receiveOrRespond<UserUpdate>() ?: return@put
                val status = UserService.update(
                    id,
                    userUpdate.name,
                    userUpdate.email,
                    userUpdate.password,
                    userUpdate.permissions,
                )
                if (status) {
                    call.respond(HttpStatusCode.Companion.NoContent)
                } else {
                    call.respond(
                        HttpStatusCode.Companion.NotFound,
                        "can't update user, invalid id or email already exists"
                    )
                }

            }
            delete("/{id}") {
                val id = call.parameters["id"]?.toIntOrNull()
                if (id == null) {
                    call.respond(HttpStatusCode.Companion.BadRequest, "can't read id")
                    return@delete
                }
                if (UserService.delete(id)) {
                    call.respond(HttpStatusCode.Companion.NoContent)
                } else {
                    call.respond(HttpStatusCode.Companion.NotFound)
                }
            }
            get("/{id}") {
                val id = call.parameters["id"]?.toIntOrNull()
                if (id == null) {
                    call.respond(HttpStatusCode.Companion.BadRequest, "can't read id")
                    return@get
                }
                val user = UserService.getById(id)
                if (user == null) {
                    call.respond(HttpStatusCode.Companion.NotFound)
                    return@get
                }
                call.respond(user)
            }
            get("/findByName/{name}") {
                val name = call.parameters["name"]
                if (name == null) {
                    call.respond(HttpStatusCode.Companion.BadRequest, "name is required")
                    return@get
                }
                val user = UserService.findLikeName(name)
                if (user.isEmpty()) {
                    call.respond(HttpStatusCode.Companion.NotFound)
                    return@get
                }
                call.respond(user)
            }

            get("/byName/{name}") {
                val name = call.parameters["name"]
                if (name == null) {
                    call.respond(HttpStatusCode.Companion.BadRequest, "name is required")
                    return@get
                }
                val user = UserService.getByName(name)
                if (user.isEmpty()) {
                    call.respond(HttpStatusCode.Companion.NotFound)
                    return@get
                }
                call.respond(user)
            }

            get("/byEmail/{email}") {
                val email = call.parameters["email"]
                if (email == null) {
                    call.respond(HttpStatusCode.Companion.BadRequest, "email is required")
                    return@get
                }
                val user = UserService.getByEmail(email)
                if (user == null) {
                    call.respond(HttpStatusCode.Companion.NotFound)
                    return@get
                }
                call.respond(user)
            }

        }
    }
}