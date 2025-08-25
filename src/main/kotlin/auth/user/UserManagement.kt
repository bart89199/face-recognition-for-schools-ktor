package com.batr.auth.user


import com.batr.auth.getSession
import com.batr.auth.session.getUser
import com.batr.auth.setPermissions
import com.batr.fetchQueryInts
import com.batr.fetchQueryStrings
import com.batr.log.AdminLogType
import com.batr.log.log
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
            route("/api/user/profile") {
                get {
                    val session = call.getSession() ?: return@get
                    val user = session.getUser().toNoPass()
                    call.respond(user)
                }
                put {
                    val session = call.getSession() ?: return@put
                    val user = session.getUser().toNoPass()
                    val userUpdate = call.receiveOrRespond<UserUpdate>() ?: return@put
                    if (userUpdate.password?.isBlank() == true) {
                        call.respond(HttpStatusCode.BadRequest, "password is required")
                        return@put
                    }
                    val status = UserService.update(
                        user.id,
                        newName = userUpdate.name,
                        newPassword = userUpdate.password,
                    )
                    if (status) {
                        session.log(
                            AdminLogType.USER_UPDATE,
                            "update own profile (${userUpdate.name?.let { name -> "name: ${user.name} -> $name" } ?: ""} ${userUpdate.password?.let { "new password" } ?: ""})"
                        )
                        call.respond(HttpStatusCode.OK)
                    } else {
                        call.respond(
                            HttpStatusCode.BadRequest,
                            "can't update user, something went wrong"
                        )
                    }
                }
            }

            setPermissions(UserPermissions(admin = true)) {
                route("/api/manage/user") {
                    get {
                        val ids = fetchQueryInts("id") ?: return@get
                        if (ids.isEmpty()) {
                            val users = UserService.getAll().map { it.toNoPass() }
                            call.respond(users)
                            return@get
                        }
                        val user = UserService.getByIds(ids).map { it.toNoPass() }
                        if (user.isEmpty()) {
                            call.respond(HttpStatusCode.NotFound)
                            return@get
                        }
                        call.respond(user)
                    }

                    delete {
                        val session = call.getSession() ?: return@delete
                        val id = fetchQueryInts("id") ?: return@delete
                        if (id.isEmpty()) {
                            call.respond(HttpStatusCode.BadRequest, "id is required")
                            return@delete
                        }
                        val users = UserService.getByIds(id)
                        if (users.isEmpty()) {
                            call.respond(HttpStatusCode.NotFound, "user not found")
                            return@delete
                        }
                        users.forEach { user ->
                            if (user.isRoot()) {
                                if (session.isRoot() != true) {
                                    call.respond(HttpStatusCode.Forbidden)
                                    return@delete
                                }
                            }
                        }
                    }

                    post {
                        val session = call.getSession() ?: return@post
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
                            session.log(
                                AdminLogType.USER_CREATED,
                                "create user: $id (name = ${newUser.name}, email = ${newUser.email}, root = ${newUser.root}), permissions = ${newUser.permissions})"
                            )
                            call.respond(HttpStatusCode.OK, id)
                        } else {
                            call.respond(
                                HttpStatusCode.BadRequest,
                                "can't create user, email already exists or something wrong with db"
                            )
                        }
                    }

                    route("/{id}") {
                        get {
                            val id = call.parameters["id"]?.toIntOrNull()
                            if (id == null) {
                                call.respond(HttpStatusCode.BadRequest, "can't read id")
                                return@get
                            }
                            val user = UserService.getById(id)?.toNoPass()
                            if (user == null) {
                                call.respond(HttpStatusCode.NotFound)
                                return@get
                            }
                            call.respond(user)
                        }

                        delete {
                            val session = call.getSession() ?: return@delete
                            val id = call.parameters["id"]?.toIntOrNull()
                            if (id == null) {
                                call.respond(HttpStatusCode.BadRequest, "can't read id")
                                return@delete
                            }
                            val user = UserService.getById(id)
                            if (user == null) {
                                call.respond(HttpStatusCode.NotFound, "user not found")
                                return@delete
                            }
                            if (user.isRoot()) {
                                if (session.isRoot() != true) {
                                    call.respond(HttpStatusCode.Forbidden)
                                    return@delete
                                }
                            }
                            if (UserService.deleteById(id)) {
                                session.log(
                                    AdminLogType.USER_DELETE,
                                    "delete user $id (name = ${user.name}, email = ${user.email}, root = ${user.root}), permissions = ${user.permissions})"
                                )
                                call.respond(HttpStatusCode.OK)
                            } else {
                                call.respond(HttpStatusCode.NotFound)
                            }
                        }

                        put {
                            val session = call.getSession() ?: return@put
                            val id = call.parameters["id"]?.toIntOrNull()
                            if (id == null) {
                                call.respond(HttpStatusCode.BadRequest, "can't read id")
                                return@put
                            }
                            val user = UserService.getById(id)
                            if (user == null) {
                                call.respond(HttpStatusCode.NotFound, "user not found")
                                return@put
                            }
                            val userUpdate = call.receiveOrRespond<UserUpdate>() ?: return@put
                            if (user.isRoot() || userUpdate.root == true) {
                                if (session.isRoot() != true) {
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
                                session.log(
                                    AdminLogType.USER_UPDATE, "update user $id (" +
                                            "${userUpdate.name?.let { name -> "name: ${user.name} -> $name" } ?: ""} " +
                                            "${userUpdate.email?.let { email -> "email: ${user.email} -> $email" } ?: ""} " +
                                            "${userUpdate.password?.let { "new password" } ?: ""} " +
                                            "${userUpdate.root?.let { root -> "root: ${user.root} -> $root" } ?: ""} " +
                                            "${userUpdate.permissions?.let { perm -> "permissions: ${user.permissions} -> $perm" } ?: ""})"
                                )
                                call.respond(HttpStatusCode.OK)
                            } else {
                                call.respond(
                                    HttpStatusCode.NotFound,
                                    "can't update user, invalid id or email already exists"
                                )
                            }
                        }
                    }

                    get("/findByName") {
                        val name = call.queryParameters["name"]
                        if (name == null) {
                            call.respond(HttpStatusCode.BadRequest, "name is required")
                            return@get
                        }
                        val user = UserService.findLikeName(name).map { it.toNoPass() }
                        if (user.isEmpty()) {
                            call.respond(HttpStatusCode.NotFound)
                            return@get
                        }
                        call.respond(user)
                    }

                    get("/findByEmail") {
                        val email = call.queryParameters["email"]
                        if (email == null) {
                            call.respond(HttpStatusCode.BadRequest, "email is required")
                            return@get
                        }
                        val user = UserService.findLikeEmail(email).map { it.toNoPass() }
                        if (user.isEmpty()) {
                            call.respond(HttpStatusCode.NotFound)
                            return@get
                        }
                        call.respond(user)
                    }

                    get("/byName") {
                        val names = fetchQueryStrings("name")
                        if (names.isEmpty()) {
                            call.respond(HttpStatusCode.BadRequest, "name is required")
                            return@get
                        }
                        val user = UserService.getByNames(names).map { it.toNoPass() }
                        if (user.isEmpty()) {
                            call.respond(HttpStatusCode.NotFound)
                            return@get
                        }
                        call.respond(user)
                    }

                    get("/byEmail") {
                        val emails = fetchQueryStrings("email")
                        if (emails.isEmpty()) {
                            call.respond(HttpStatusCode.BadRequest, "email is required")
                            return@get
                        }
                        val user = UserService.getByEmails(emails).map { it.toNoPass() }
                        if (user.isEmpty()) {
                            call.respond(HttpStatusCode.NotFound)
                            return@get
                        }
                        call.respond(user)
                    }

                }
            }
        }
    }
}