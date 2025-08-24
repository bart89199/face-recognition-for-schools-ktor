package com.batr

import io.ktor.http.HttpStatusCode
import io.ktor.server.application.Application
import io.ktor.server.response.respond
import io.ktor.server.routing.delete
import io.ktor.server.routing.get
import io.ktor.server.routing.route
import io.ktor.server.routing.routing
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class People(
    val id: Int,
    val name: String,
    val email: String,
    val images: List<String>
)

private val peoples =
    mutableListOf(
        People(1, "Bob", "bob@fmsh.ru", listOf()),
        People(2, "Ben", "ben@lol.ru", listOf("kek.jpg", "lol.jpg"))
    )

@Serializable
data class Form(
    val id: Int,
    val name: String,
    val link: String,
    @SerialName("collect_name") val collectName: Boolean,
    @SerialName("on_domain") val onDomain: Boolean,
    @SerialName("answer_count") val answerCount: Int,
)

private val forms = mutableListOf(
    Form(1, "Form1", "https://docs.google.com/forms/d/1xfl6lFFMeqXw-B9e1Eqa4MkxE4Gmv-qaBBRTTd2ozvM", true, false, 0),
    Form(2, "Form2", "https://docs.google.com/forms/d/1xfl6lFFMeqXw-B9e1Eqa4MkxE4Gmv-qaBBRTTd2ozvM", false, true, 10),
)

@Serializable
data class FormAnswer(
    val id: Int,
    val name: String,
    val email: String,
    val images: List<String>
)

private val formAnswers = mutableMapOf(
    1 to listOf(FormAnswer(4, "Иван Иванович", "iivanovich@fmschool72.ru", listOf())),
    2 to listOf(
        FormAnswer(
            2, "Владимир Иванович", "vivanovich@fmschool72.ru", listOf("/images/a.jpg", "/images/b.jpg")
        ),
        FormAnswer(
            532, "Глеб Иванович", "givanovich@fmschool72.ru", listOf("/images/bbb.png", "/images/vedf.jpg")
        )
    ),
)

fun Application.configureAccess() {
    routing {
        route("/api/access") {
            route("/people") {
                get {
                    call.respond(peoples)
                }

            }

            route("/forms") {
                get {
                    call.respond(forms)
                }
                route("/{id}") {
                    get("/answers") {
                        val id = call.parameters["id"]?.toIntOrNull()
                        val answers = formAnswers[id]
                        if (answers == null) {
                            call.respond(HttpStatusCode.BadRequest)
                            return@get
                        }
                        call.respond(answers)
                    }
                    delete {
                        val id = call.parameters["id"]?.toIntOrNull()
                        if (id == null) {
                            call.respond(HttpStatusCode.BadRequest)
                            return@delete
                        }
                        if (!forms.removeIf { it.id == id }) {
                            call.respond(HttpStatusCode.NotFound)
                            return@delete
                        }
                        call.respond(HttpStatusCode.NoContent)
                    }
                }
            }
        }
    }
}