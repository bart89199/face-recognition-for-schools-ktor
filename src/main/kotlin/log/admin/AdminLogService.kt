package com.batr.log.admin

import com.batr.database.Database.suspendTransaction
import org.jetbrains.exposed.sql.Op
import org.jetbrains.exposed.sql.Query
import org.jetbrains.exposed.sql.SchemaUtils
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import org.jetbrains.exposed.sql.SqlExpressionBuilder.greaterEq
import org.jetbrains.exposed.sql.SqlExpressionBuilder.lessEq
import org.jetbrains.exposed.sql.and
import org.jetbrains.exposed.sql.insert
import org.jetbrains.exposed.sql.or
import org.jetbrains.exposed.sql.selectAll
import org.jetbrains.exposed.sql.transactions.transaction

object AdminLogService {
    fun load() {
        transaction {
            SchemaUtils.create(AdminLogTable)
        }
    }

    suspend fun log(type: AdminLogType, message: String, time: Long = System.currentTimeMillis()): Unit =
        suspendTransaction {
            AdminLogTable.insert {
                it[AdminLogTable.type] = type
                it[AdminLogTable.time] = time
                it[AdminLogTable.message] = message
            }
        }

    private fun Query.toModel(): List<AdminLog> = map {
        AdminLog(
            type = it[AdminLogTable.type],
            time = it[AdminLogTable.time],
            message = it[AdminLogTable.message]
        )
    }

    private fun time(start: Long?, end: Long?): Op<Boolean> =
        (if (start == null) Op.TRUE else AdminLogTable.time greaterEq start) and
                (if (end == null) Op.TRUE else AdminLogTable.time lessEq end)

    private fun type(type: List<AdminLogType>): Op<Boolean> =
        type.fold<AdminLogType, Op<Boolean>>(Op.TRUE) { base, type ->
            base or (AdminLogTable.type eq type)
        }

    suspend fun getLogs(
        type: List<AdminLogType> = emptyList(),
        start: Long? = null,
        end: Long? = null
    ): List<AdminLog> =
        suspendTransaction {
            AdminLogTable.selectAll().where(type(type) and time(start, end)).toModel()
        }
}