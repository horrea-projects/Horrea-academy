drop extension if exists "pg_net";


  create table "public"."app_users" (
    "id" uuid not null default gen_random_uuid(),
    "clerk_id" text not null,
    "email" text not null,
    "name" text,
    "is_admin" boolean not null default false,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
      );



  create table "public"."categories" (
    "id" uuid not null default gen_random_uuid(),
    "slug" text not null,
    "label" text not null,
    "icon" text not null,
    "created_at" timestamp with time zone default now()
      );



  create table "public"."course_missions" (
    "id" uuid not null default gen_random_uuid(),
    "course_id" uuid not null,
    "mission_slug" text not null,
    "title" text not null,
    "context" text not null,
    "objective" text not null,
    "instructions" jsonb not null default '[]'::jsonb,
    "deliverable" text not null
      );



  create table "public"."course_modules" (
    "id" uuid not null default gen_random_uuid(),
    "course_id" uuid not null,
    "module_slug" text not null,
    "title" text not null,
    "description" text not null,
    "duration" text not null,
    "video_embed_url" text not null,
    "document_embed_url" text,
    "presentation_embed_url" text,
    "quiz_sheet_id" text,
    "mission_id_slug" text,
    "content" text,
    "position" integer not null
      );



  create table "public"."courses" (
    "id" uuid not null default gen_random_uuid(),
    "slug" text not null,
    "title" text not null,
    "description" text not null,
    "duration" text not null,
    "category_id" uuid,
    "published" boolean not null default false,
    "added_at" timestamp with time zone default now(),
    "created_by" text
      );



  create table "public"."user_progress" (
    "id" uuid not null default gen_random_uuid(),
    "email" text not null,
    "course_slug" text not null,
    "module_id" text not null,
    "status" text not null,
    "score" numeric,
    "type" text,
    "date" timestamp with time zone default now()
      );


CREATE UNIQUE INDEX app_users_clerk_id_key ON public.app_users USING btree (clerk_id);

CREATE UNIQUE INDEX app_users_pkey ON public.app_users USING btree (id);

CREATE UNIQUE INDEX categories_pkey ON public.categories USING btree (id);

CREATE UNIQUE INDEX categories_slug_key ON public.categories USING btree (slug);

CREATE UNIQUE INDEX course_missions_course_id_mission_slug_key ON public.course_missions USING btree (course_id, mission_slug);

CREATE UNIQUE INDEX course_missions_pkey ON public.course_missions USING btree (id);

CREATE UNIQUE INDEX course_modules_course_id_module_slug_key ON public.course_modules USING btree (course_id, module_slug);

CREATE UNIQUE INDEX course_modules_pkey ON public.course_modules USING btree (id);

CREATE UNIQUE INDEX courses_pkey ON public.courses USING btree (id);

CREATE UNIQUE INDEX courses_slug_key ON public.courses USING btree (slug);

CREATE INDEX idx_app_users_clerk_id ON public.app_users USING btree (clerk_id);

CREATE INDEX idx_app_users_email ON public.app_users USING btree (lower(email));

CREATE INDEX idx_user_progress_course_module ON public.user_progress USING btree (course_slug, module_id);

CREATE INDEX idx_user_progress_email ON public.user_progress USING btree (lower(email));

CREATE UNIQUE INDEX user_progress_pkey ON public.user_progress USING btree (id);

alter table "public"."app_users" add constraint "app_users_pkey" PRIMARY KEY using index "app_users_pkey";

alter table "public"."categories" add constraint "categories_pkey" PRIMARY KEY using index "categories_pkey";

alter table "public"."course_missions" add constraint "course_missions_pkey" PRIMARY KEY using index "course_missions_pkey";

alter table "public"."course_modules" add constraint "course_modules_pkey" PRIMARY KEY using index "course_modules_pkey";

alter table "public"."courses" add constraint "courses_pkey" PRIMARY KEY using index "courses_pkey";

alter table "public"."user_progress" add constraint "user_progress_pkey" PRIMARY KEY using index "user_progress_pkey";

alter table "public"."app_users" add constraint "app_users_clerk_id_key" UNIQUE using index "app_users_clerk_id_key";

alter table "public"."categories" add constraint "categories_slug_key" UNIQUE using index "categories_slug_key";

alter table "public"."course_missions" add constraint "course_missions_course_id_fkey" FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE not valid;

alter table "public"."course_missions" validate constraint "course_missions_course_id_fkey";

alter table "public"."course_missions" add constraint "course_missions_course_id_mission_slug_key" UNIQUE using index "course_missions_course_id_mission_slug_key";

alter table "public"."course_modules" add constraint "course_modules_course_id_fkey" FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE not valid;

alter table "public"."course_modules" validate constraint "course_modules_course_id_fkey";

alter table "public"."course_modules" add constraint "course_modules_course_id_module_slug_key" UNIQUE using index "course_modules_course_id_module_slug_key";

alter table "public"."courses" add constraint "courses_category_id_fkey" FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE SET NULL not valid;

alter table "public"."courses" validate constraint "courses_category_id_fkey";

alter table "public"."courses" add constraint "courses_slug_key" UNIQUE using index "courses_slug_key";

grant delete on table "public"."app_users" to "anon";

grant insert on table "public"."app_users" to "anon";

grant references on table "public"."app_users" to "anon";

grant select on table "public"."app_users" to "anon";

grant trigger on table "public"."app_users" to "anon";

grant truncate on table "public"."app_users" to "anon";

grant update on table "public"."app_users" to "anon";

grant delete on table "public"."app_users" to "authenticated";

grant insert on table "public"."app_users" to "authenticated";

grant references on table "public"."app_users" to "authenticated";

grant select on table "public"."app_users" to "authenticated";

grant trigger on table "public"."app_users" to "authenticated";

grant truncate on table "public"."app_users" to "authenticated";

grant update on table "public"."app_users" to "authenticated";

grant delete on table "public"."app_users" to "service_role";

grant insert on table "public"."app_users" to "service_role";

grant references on table "public"."app_users" to "service_role";

grant select on table "public"."app_users" to "service_role";

grant trigger on table "public"."app_users" to "service_role";

grant truncate on table "public"."app_users" to "service_role";

grant update on table "public"."app_users" to "service_role";

grant delete on table "public"."categories" to "anon";

grant insert on table "public"."categories" to "anon";

grant references on table "public"."categories" to "anon";

grant select on table "public"."categories" to "anon";

grant trigger on table "public"."categories" to "anon";

grant truncate on table "public"."categories" to "anon";

grant update on table "public"."categories" to "anon";

grant delete on table "public"."categories" to "authenticated";

grant insert on table "public"."categories" to "authenticated";

grant references on table "public"."categories" to "authenticated";

grant select on table "public"."categories" to "authenticated";

grant trigger on table "public"."categories" to "authenticated";

grant truncate on table "public"."categories" to "authenticated";

grant update on table "public"."categories" to "authenticated";

grant delete on table "public"."categories" to "service_role";

grant insert on table "public"."categories" to "service_role";

grant references on table "public"."categories" to "service_role";

grant select on table "public"."categories" to "service_role";

grant trigger on table "public"."categories" to "service_role";

grant truncate on table "public"."categories" to "service_role";

grant update on table "public"."categories" to "service_role";

grant delete on table "public"."course_missions" to "anon";

grant insert on table "public"."course_missions" to "anon";

grant references on table "public"."course_missions" to "anon";

grant select on table "public"."course_missions" to "anon";

grant trigger on table "public"."course_missions" to "anon";

grant truncate on table "public"."course_missions" to "anon";

grant update on table "public"."course_missions" to "anon";

grant delete on table "public"."course_missions" to "authenticated";

grant insert on table "public"."course_missions" to "authenticated";

grant references on table "public"."course_missions" to "authenticated";

grant select on table "public"."course_missions" to "authenticated";

grant trigger on table "public"."course_missions" to "authenticated";

grant truncate on table "public"."course_missions" to "authenticated";

grant update on table "public"."course_missions" to "authenticated";

grant delete on table "public"."course_missions" to "service_role";

grant insert on table "public"."course_missions" to "service_role";

grant references on table "public"."course_missions" to "service_role";

grant select on table "public"."course_missions" to "service_role";

grant trigger on table "public"."course_missions" to "service_role";

grant truncate on table "public"."course_missions" to "service_role";

grant update on table "public"."course_missions" to "service_role";

grant delete on table "public"."course_modules" to "anon";

grant insert on table "public"."course_modules" to "anon";

grant references on table "public"."course_modules" to "anon";

grant select on table "public"."course_modules" to "anon";

grant trigger on table "public"."course_modules" to "anon";

grant truncate on table "public"."course_modules" to "anon";

grant update on table "public"."course_modules" to "anon";

grant delete on table "public"."course_modules" to "authenticated";

grant insert on table "public"."course_modules" to "authenticated";

grant references on table "public"."course_modules" to "authenticated";

grant select on table "public"."course_modules" to "authenticated";

grant trigger on table "public"."course_modules" to "authenticated";

grant truncate on table "public"."course_modules" to "authenticated";

grant update on table "public"."course_modules" to "authenticated";

grant delete on table "public"."course_modules" to "service_role";

grant insert on table "public"."course_modules" to "service_role";

grant references on table "public"."course_modules" to "service_role";

grant select on table "public"."course_modules" to "service_role";

grant trigger on table "public"."course_modules" to "service_role";

grant truncate on table "public"."course_modules" to "service_role";

grant update on table "public"."course_modules" to "service_role";

grant delete on table "public"."courses" to "anon";

grant insert on table "public"."courses" to "anon";

grant references on table "public"."courses" to "anon";

grant select on table "public"."courses" to "anon";

grant trigger on table "public"."courses" to "anon";

grant truncate on table "public"."courses" to "anon";

grant update on table "public"."courses" to "anon";

grant delete on table "public"."courses" to "authenticated";

grant insert on table "public"."courses" to "authenticated";

grant references on table "public"."courses" to "authenticated";

grant select on table "public"."courses" to "authenticated";

grant trigger on table "public"."courses" to "authenticated";

grant truncate on table "public"."courses" to "authenticated";

grant update on table "public"."courses" to "authenticated";

grant delete on table "public"."courses" to "service_role";

grant insert on table "public"."courses" to "service_role";

grant references on table "public"."courses" to "service_role";

grant select on table "public"."courses" to "service_role";

grant trigger on table "public"."courses" to "service_role";

grant truncate on table "public"."courses" to "service_role";

grant update on table "public"."courses" to "service_role";

grant delete on table "public"."user_progress" to "anon";

grant insert on table "public"."user_progress" to "anon";

grant references on table "public"."user_progress" to "anon";

grant select on table "public"."user_progress" to "anon";

grant trigger on table "public"."user_progress" to "anon";

grant truncate on table "public"."user_progress" to "anon";

grant update on table "public"."user_progress" to "anon";

grant delete on table "public"."user_progress" to "authenticated";

grant insert on table "public"."user_progress" to "authenticated";

grant references on table "public"."user_progress" to "authenticated";

grant select on table "public"."user_progress" to "authenticated";

grant trigger on table "public"."user_progress" to "authenticated";

grant truncate on table "public"."user_progress" to "authenticated";

grant update on table "public"."user_progress" to "authenticated";

grant delete on table "public"."user_progress" to "service_role";

grant insert on table "public"."user_progress" to "service_role";

grant references on table "public"."user_progress" to "service_role";

grant select on table "public"."user_progress" to "service_role";

grant trigger on table "public"."user_progress" to "service_role";

grant truncate on table "public"."user_progress" to "service_role";

grant update on table "public"."user_progress" to "service_role";


