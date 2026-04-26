import io.ktor.plugin.features.DockerImageRegistry

val exposed_version: String by project
val kotlin_version: String by project
val logback_version: String by project
val postgres_version: String by project
val ktor_version: String by project

plugins {
    kotlin("jvm") version "2.2.10"
    id("io.ktor.plugin") version "3.2.3"
    id("org.jetbrains.kotlin.plugin.serialization") version "2.2.10"
}

group = "com.batr"
version = "1.1.22"

application {
    mainClass = "io.ktor.server.netty.EngineMain"
}

repositories {
    mavenCentral()
}

dependencies {
    implementation("io.ktor:ktor-server-core")
    implementation("io.ktor:ktor-server-host-common")
    implementation("io.ktor:ktor-server-content-negotiation")
    implementation("io.ktor:ktor-serialization-kotlinx-json")
    implementation("org.jetbrains.exposed:exposed-core:$exposed_version")
    implementation("org.jetbrains.exposed:exposed-jdbc:$exposed_version")
    implementation("org.jetbrains.exposed:exposed-kotlin-datetime:$exposed_version")
    implementation("org.jetbrains.exposed:exposed-json:$exposed_version")
    implementation("org.jetbrains.exposed:exposed-dao:$exposed_version")

    implementation("io.ktor:ktor-server-partial-content:${ktor_version}")

    implementation("com.password4j:password4j:1.8.4")

    implementation("io.ktor:ktor-server-status-pages")
    implementation("org.postgresql:postgresql:$postgres_version")
    implementation("io.ktor:ktor-server-websockets")
    implementation("io.ktor:ktor-server-netty")
    implementation("ch.qos.logback:logback-classic:$logback_version")
    implementation("ch.qos.logback:logback-core:$logback_version")
    implementation("io.ktor:ktor-server-config-yaml")
    implementation("io.ktor:ktor-server-auth:${ktor_version}")
    implementation("io.ktor:ktor-server-sessions:${ktor_version}")
    implementation("io.ktor:ktor-server-default-headers:${ktor_version}")
    implementation("io.ktor:ktor-server-forwarded-header:${ktor_version}")
    implementation("io.ktor:ktor-server-hsts:${ktor_version}")

    testImplementation("io.ktor:ktor-server-test-host")
    testImplementation("org.jetbrains.kotlin:kotlin-test-junit:$kotlin_version")

    implementation("io.ktor:ktor-server-cors:${ktor_version}")

    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.10.2")

    implementation("io.ktor:ktor-client-core:${ktor_version}")
    implementation("io.ktor:ktor-client-cio:${ktor_version}")
    implementation("io.ktor:ktor-client-content-negotiation:${ktor_version}")

//    implementation("io.ktor:ktor-server-call-logging:${ktor_version}")
}
//jib.to.image = "face-recognition-ktor"
ktor {
    docker {
        jreVersion.set(JavaVersion.VERSION_17)
        localImageName.set("face-recognition-ktor")
        imageTag.set(version.toString())
        portMappings.set(listOf(
            io.ktor.plugin.features.DockerPortMapping(
                8080,
                8080,
                io.ktor.plugin.features.DockerPortMappingProtocol.TCP
            )
        ))

        externalRegistry.set(
            DockerImageRegistry.dockerHub(
                appName = provider { "face-recognition-ktor" },
                username = providers.environmentVariable("DOCKER_HUB_USERNAME"),
                password = providers.environmentVariable("DOCKER_HUB_PASSWORD")
            )
        )
    }
}