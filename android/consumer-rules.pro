# Applied to the app's R8 build.
#
# SallaPush Android brings WorkManager 2.9.1, whose rule keeps its Room database class but not the constructor Room 2.5
# calls by reflection. R8's strict full mode, the default from the Android Gradle plugin 9, then removes it, and every
# start of a minified app crashes in WorkManager's initializer. SallaPush Android 1.0.3 ships this rule too; it stays
# here for a build that resolves an older SallaPush Android.
-keep class * extends androidx.room.RoomDatabase {
    <init>();
}
