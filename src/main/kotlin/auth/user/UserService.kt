package com.batr.auth.user

import com.batr.auth.PasswordHasher
import com.batr.auth.session.GoogleAccess
import com.batr.auth.session.RequestData
import com.batr.auth.session.SessionService
import com.batr.auth.session.UserSession
import com.batr.auth.session.getRequestData
import io.ktor.server.application.ApplicationCall
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.core.inList
import org.jetbrains.exposed.v1.core.like
import org.jetbrains.exposed.v1.exceptions.ExposedSQLException
import org.jetbrains.exposed.v1.jdbc.Query
import org.jetbrains.exposed.v1.jdbc.SchemaUtils
import org.jetbrains.exposed.v1.jdbc.deleteWhere
import org.jetbrains.exposed.v1.jdbc.insert
import org.jetbrains.exposed.v1.jdbc.selectAll
import org.jetbrains.exposed.v1.jdbc.transactions.suspendTransaction
import org.jetbrains.exposed.v1.jdbc.transactions.transaction
import org.jetbrains.exposed.v1.jdbc.update

import org.postgresql.util.PSQLException

object UserService {
    fun load() {
        transaction {
            SchemaUtils.create(UserTable)
        }
    }


    suspend fun createUser(rawUser: RawUser, hashPassword: Boolean = true): Int = suspendTransaction {
        val password = if (hashPassword) PasswordHasher.hash(rawUser.password).result else rawUser.password
        try {
            UserTable.insert {
                it[name] = rawUser.name
                it[email] = rawUser.email
                it[UserTable.password] = password
                it[UserTable.root] = rawUser.root
                it[permissions] = rawUser.permissions
            }[UserTable.id].value
        } catch (_: ExposedSQLException) {
            -1
        }
    }

    suspend fun getAll(): List<User> = suspendTransaction {
        UserTable.selectAll().toModel()
    }

    suspend fun getById(id: Int): User? = suspendTransaction {
        UserTable.selectAll().where { UserTable.id eq id }.toModel().firstOrNull()
    }

    suspend fun getByIds(id: List<Int>): List<User> = suspendTransaction {
        UserTable.selectAll().where { UserTable.id inList id }.toModel()
    }

    suspend fun getByEmail(email: String): User? = suspendTransaction {
        UserTable.selectAll().where { UserTable.email eq email }.toModel().firstOrNull()
    }

    suspend fun getByEmails(email: List<String>): List<User> = suspendTransaction {
        UserTable.selectAll().where { UserTable.email inList email }.toModel()
    }

    suspend fun getByName(name: String): List<User> = suspendTransaction {
        UserTable.selectAll().where { UserTable.name eq name }.toModel()
    }

    suspend fun getByNames(name: List<String>): List<User> = suspendTransaction {
        UserTable.selectAll().where { UserTable.name inList name }.toModel()
    }

    suspend fun findLikeEmail(email: String): List<User> = suspendTransaction {
        UserTable.selectAll().where { UserTable.email like "%$email%" }.toModel()
    }

    suspend fun findLikeName(name: String): List<User> = suspendTransaction {
        UserTable.selectAll().where { UserTable.name like "%$name%" }.toModel()
    }

    suspend fun deleteById(id: Int): Boolean = suspendTransaction {
        UserTable.deleteWhere { UserTable.id eq id } == 1
    }

    suspend fun deleteByIds(id: List<Int>): Int = suspendTransaction {
        UserTable.deleteWhere { UserTable.id inList id }
    }

    suspend fun checkIsRoot(id: Int): Boolean? = suspendTransaction {
        UserTable.selectAll().where { UserTable.id eq id }.singleOrNull()?.get(UserTable.root)
    }

    suspend fun login(email: String, password: String): User? {
        val user = getByEmail(email)
        if (user == null || !PasswordHasher.verify(password, user.password)) return null
        return user
    }

    suspend fun update(
        id: Int,
        newName: String? = null,
        newEmail: String? = null,
        newPassword: String? = null,
        newRoot: Boolean? = null,
        newPermissions: UserPermissions? = null,
        hashNewPassword: Boolean = true
    ): Boolean = suspendTransaction {
        try {
            UserTable.update({ UserTable.id eq id }) { user ->
                newName?.let { user[UserTable.name] = it }
                newEmail?.let { user[UserTable.email] = it }
                newPassword?.let {
                    user[UserTable.password] = if (hashNewPassword) PasswordHasher.hash(it).result else it
                }
                newRoot?.let { user[UserTable.root] = it }
                newPermissions?.let { user[UserTable.permissions] = it }
            } == 1
        } catch (_: ExposedSQLException) {
            false
        }
    }

    private fun Query.toModel(): List<User> = map {
        User(
            id = it[UserTable.id].value,
            name = it[UserTable.name],
            email = it[UserTable.email],
            password = it[UserTable.password],
            root = it[UserTable.root],
            permissions = it[UserTable.permissions]
        )
    }
}

suspend fun User.newSession(
    requestData: RequestData,
    longLogin: Boolean = false,
    googleAccess: GoogleAccess? = null
): UserSession =
    SessionService.create(id, longLogin = longLogin, requestData = requestData, googleAccess = googleAccess)

suspend fun User.newSession(
    call: ApplicationCall,
    longLogin: Boolean = false,
    googleAccess: GoogleAccess? = null
): UserSession =
    SessionService.create(id, longLogin = longLogin, requestData = call.getRequestData(), googleAccess = googleAccess)

suspend fun User.isRootOrNull(): Boolean? = UserService.checkIsRoot(id)
suspend fun User.isRoot(): Boolean = isRootOrNull() ?: throw IllegalArgumentException("Can`t find user")
suspend fun UserSession.isRoot(): Boolean? = UserService.checkIsRoot(userId)