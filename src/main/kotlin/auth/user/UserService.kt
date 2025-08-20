package com.batr.auth.user

import com.batr.auth.PasswordHasher
import com.batr.database.Database.suspendTransaction
import org.jetbrains.exposed.exceptions.ExposedSQLException
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import org.jetbrains.exposed.sql.transactions.transaction

object UserService {
    fun load() {
        transaction {
            SchemaUtils.create(UserTable)
        }
    }


    suspend fun createUser(rawUser: RawUser, hashPassword: Boolean = true) = suspendTransaction {
        val password = if (hashPassword) PasswordHasher.hash(rawUser.password).result else rawUser.password
        try {
            UserTable.insert {
                it[name] = rawUser.name
                it[email] = rawUser.email
                it[UserTable.password] = password
                it[permissions] = rawUser.permissions
            }[UserTable.id].value
        } catch (_: ExposedSQLException) {
            -1
        }
    }

    suspend fun getAll() = suspendTransaction {
        UserTable.selectAll().toModel()
    }

    suspend fun getById(id: Int) = suspendTransaction {
        UserTable.selectAll().where { UserTable.id eq id }.toModel().firstOrNull()
    }

    suspend fun getByEmail(email: String) = suspendTransaction {
        UserTable.selectAll().where { UserTable.email eq email }.toModel().firstOrNull()
    }

    suspend fun getByName(name: String) = suspendTransaction {
        UserTable.selectAll().where { UserTable.name eq name }.toModel()
    }

    suspend fun findLikeEmail(email: String) = suspendTransaction {
        UserTable.selectAll().where { UserTable.email like "%$email%" }.toModel()
    }

    suspend fun findLikeName(name: String) = suspendTransaction {
        UserTable.selectAll().where { UserTable.name like "%$name%" }.toModel()
    }

    suspend fun delete(id: Int) = suspendTransaction {
        UserTable.deleteWhere { UserTable.id eq id } == 1
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
        newPermissions: UserPermissions? = null,
        hashNewPassword: Boolean = true
    ) = suspendTransaction {
        UserTable.update({ UserTable.id eq id }) { user ->
            newName?.let { user[UserTable.name] = it }
            newEmail?.let { user[UserTable.email] = it }
            newPassword?.let {
                user[UserTable.password] = if (hashNewPassword) PasswordHasher.hash(it).result else it
            }
            newPermissions?.let { user[UserTable.permissions] = it }
        } == 1
    }

    private fun Query.toModel() = map {
        User(
            it[UserTable.id].value,
            it[UserTable.name],
            it[UserTable.email],
            it[UserTable.password],
            it[UserTable.permissions]
        )
    }
}