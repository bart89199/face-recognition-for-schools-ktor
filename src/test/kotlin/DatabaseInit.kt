import com.batr.auth.user.RawUser
import com.batr.auth.user.UserService
import com.batr.auth.user.UserTable
import kotlinx.coroutines.runBlocking
import org.jetbrains.exposed.v1.jdbc.Database
import org.jetbrains.exposed.v1.jdbc.SchemaUtils
import org.jetbrains.exposed.v1.jdbc.transactions.transaction

fun main() {
    val url = readln()
    val user = readln()
    val password = readln()
    val database = readln()
    val userName = readln()
    val userEmail = readln()
    val userPassword = readln()
    val userIsRoot = readln().toBoolean()
    Database.connect("jdbc:postgresql://$url/$database", user = user, password = password)

    transaction {
        SchemaUtils.create(UserTable)
    }
    runBlocking {
        UserService.createUser(RawUser(userName, userEmail, userPassword, userIsRoot))
    }
}

/*
localhost:5432
postgres
4kfR8ufnwkv5Vfe6UIm8UDkIZ3lZiCsarBghrIAb1S5vALnrNa
face-recognition
batr
dsyslov@fmschool72.ru
12349876
true
 */
/*
84.201.163.245:5432
postgres
4kfR8ufnwkv5Vfe6UIm8UDkIZ3lZiCsarBghrIAb1S5vALnrNa
face-recognition
batr
dsyslov@fmschool72.ru
12349876
true
 */