package com.batr.auth.user


import com.batr.auth.getSession
import com.batr.auth.session.getUser
import com.batr.auth.setPermissions
import com.batr.receiveOrRespond
import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.auth.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import kotlinx.serialization.Serializable

@Serializable
data class UserUpdate(
    val name: String? = null,
    val email: String? = null,
    val password: String? = null,
    val root: Boolean? = null,
    val permissions: UserPermissions? = null,
)


fun Application.configureUserManagement() {
    routing {
        authenticate("session-auth") {
            route("/api/user") {
                get {
                    val session = call.getSession() ?: return@get
                    val user = session.getUser().toNoPass()
                    call.respond(user)
                }
                put {
                    val session = call.getSession() ?: return@put
                    val user = session.getUser().toNoPass()
                    val userUpdate = call.receiveOrRespond<UserUpdate>() ?: return@put

                    val status = UserService.update(
                        user.id,
                        newName = userUpdate.name,
                        newEmail = userUpdate.email,
                        newPassword = userUpdate.password,
                    )
                    if (status) {
                        call.respond(HttpStatusCode.Companion.NoContent)
                    } else {
                        call.respond(
                            HttpStatusCode.Companion.BadRequest,
                            "can't update user, something went wrong"
                        )
                    }
                }
            }

            setPermissions(UserPermissions(admin = true)) {
                route("/auth/manage") {

                    get {
                        val users = UserService.getAll().map { it.toNoPass() }
                        call.respond(users)
                    }

                    post {
                        val newUser = call.receiveOrRespond<RawUser>() ?: return@post
                        if (newUser.password.isBlank()) {
                            call.respond(HttpStatusCode.BadRequest, "password is required")
                            return@post
                        }
                        if (newUser.root) {
                            if (call.getSession()?.isRoot() != true) {
                                call.respond(HttpStatusCode.Forbidden)
                                return@post
                            }
                        }
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
                        if (UserService.getById(id)?.isRoot() == true || userUpdate.root == true) {
                            if (call.getSession()?.isRoot() != true) {
                                call.respond(HttpStatusCode.Forbidden)
                                return@put
                            }
                        }
                        val status = UserService.update(
                            id,
                            userUpdate.name,
                            userUpdate.email,
                            userUpdate.password,
                            userUpdate.root,
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
                        if (UserService.getById(id)?.isRoot() == true) {
                            if (call.getSession()?.isRoot() != true) {
                                call.respond(HttpStatusCode.Forbidden)
                                return@delete
                            }
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
                        val user = UserService.getById(id)?.toNoPass()
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
                        val user = UserService.findLikeName(name).map { it.toNoPass() }
                        if (user.isEmpty()) {
                            call.respond(HttpStatusCode.Companion.NotFound)
                            return@get
                        }
                        call.respond(user)
                    }

                    get("/findByEmail/{email}") {
                        val email = call.parameters["email"]
                        if (email == null) {
                            call.respond(HttpStatusCode.Companion.BadRequest, "email is required")
                            return@get
                        }
                        val user = UserService.findLikeEmail(email).map { it.toNoPass() }
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
                        val user = UserService.getByName(name).map { it.toNoPass() }
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
                        val user = UserService.getByEmail(email)?.toNoPass()
                        if (user == null) {
                            call.respond(HttpStatusCode.Companion.NotFound)
                            return@get
                        }
                        call.respond(user)
                    }
                }
            }
        }
    }
}