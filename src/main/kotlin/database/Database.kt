package com.batr.database

import io.ktor.server.application.Application
import kotlinx.coroutines.Dispatchers
import org.jetbrains.exposed.sql.Database
import org.jetbrains.exposed.sql.Transaction
import org.jetbrains.exposed.sql.transactions.experimental.newSuspendedTransaction

object Database {
    suspend fun <T> suspendTransaction(block: Transaction.() -> T): T =
        newSuspendedTransaction(Dispatchers.IO, statement = block)

    fun Application.configureDatabase() {
        Database.connect(
            environment.config.property("postgres.url").getString(),
            user = environment.config.property("postgres.user").getString(),
            password = environment.config.property("postgres.password").getString()
        )

    }
}