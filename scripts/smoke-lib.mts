import { getCategoriesFromDb, getPublishedCoursesFromDb, getCourseBySlugFromDb } from "../lib/courses-catalogue.ts";
import { getProgressForCourse, getProgressForAllCourses } from "../lib/progress.ts";
import { getMetiersWithFormations, getUserMetiers } from "../lib/metiers.ts";

async function main() {
  const cats = await getCategoriesFromDb();
  console.log("getCategoriesFromDb", cats);

  const courses = await getPublishedCoursesFromDb();
  console.log("getPublishedCoursesFromDb", courses);

  const detail = await getCourseBySlugFromDb("shopify-fundamentals");
  console.log(
    "getCourseBySlugFromDb",
    detail?.course.slug,
    "modules",
    detail?.modules?.length,
    "missions",
    detail?.missions?.length
  );

  const prog = await getProgressForCourse("learner@horrea.test", "shopify-fundamentals");
  console.log("getProgressForCourse", prog);

  const all = await getProgressForAllCourses("learner@horrea.test");
  console.log("getProgressForAllCourses keys", Object.keys(all));

  const metiers = await getMetiersWithFormations();
  console.log("getMetiersWithFormations", metiers);

  const um = await getUserMetiers("user_learner");
  console.log(
    "getUserMetiers",
    um.map((u) => ({ clerk_id: u.clerk_id, metier: u.metier?.slug }))
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
