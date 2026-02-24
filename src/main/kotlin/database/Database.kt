package com.batr.database

import io.ktor.server.application.*
import org.jetbrains.exposed.v1.jdbc.Database

object Database {
//    suspend fun <T> suspendTransaction(block: Transaction.() -> T): T =
//        org.jetbrains.exposed.v1.jdbc.transactions.suspendTransaction(statement = block)

    fun Application.configureDatabase() {
        Database.connect(
            environment.config.property("postgres.url").getString(),
            user = environment.config.property("postgres.user").getString(),
            password = environment.config.property("postgres.password").getString()
        )

    }
}