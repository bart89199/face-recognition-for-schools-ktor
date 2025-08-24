package com.batr.log.system

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

object SystemLogService {
    fun load() {
        transaction {
            SchemaUtils.create(SystemLogTable)
        }
    }

    suspend fun log(type: SystemLogType, message: String, time: Long = System.currentTimeMillis()): Unit =
        suspendTransaction {
            SystemLogTable.insert {
                it[SystemLogTable.type] = type
                it[SystemLogTable.time] = time
                it[SystemLogTable.message] = message
            }
        }

    private fun Query.toModel(): List<SystemLog> = map {
        SystemLog(
            type = it[SystemLogTable.type],
            message = it[SystemLogTable.message],
            time = it[SystemLogTable.time]
        )
    }

    private fun time(start: Long?, end: Long?): Op<Boolean> =
        (if (start == null) Op.TRUE else SystemLogTable.time greaterEq start) and
                (if (end == null) Op.TRUE else SystemLogTable.time lessEq end)

    private fun type(type: List<SystemLogType>): Op<Boolean> =
        type.fold<SystemLogType, Op<Boolean>>(Op.TRUE) { base, type ->
            base or (SystemLogTable.type eq type)
        }

    suspend fun getLogs(
        type: List<SystemLogType> = emptyList(),
        start: Long? = null,
        end: Long? = null
    ): List<SystemLog> =
        suspendTransaction {
            SystemLogTable.selectAll().where(type(type) and time(start, end)).toModel()
        }
}