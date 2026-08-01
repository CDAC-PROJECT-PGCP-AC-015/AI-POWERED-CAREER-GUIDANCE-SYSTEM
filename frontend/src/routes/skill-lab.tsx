import { createFileRoute } from "@tanstack/react-router";
import { Bookmark, BookmarkCheck, ExternalLink } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button, Card, Chip, ProgressBar, SectionTitle } from "@/components/ui-kit";
import { useApp, useCareers } from "@/lib/app-store";

export const Route = createFileRoute("/skill-lab")({
  head: () => ({
    meta: [
      { title: "Skill Lab — CareerAI" },
      { name: "description", content: "Close your skill gaps with courses recommended for each predicted career." },
      { property: "og:title", content: "Skill Lab — CareerAI" },
      { property: "og:description", content: "Targeted learning for your career gaps." },
    ],
  }),
  component: SkillLab,
});

function SkillLab() {
  const careers = useCareers();
  const { savedCourses, toggleCourse } = useApp();
  const all = careers.flatMap((c) => c.courses);

  return (
    <AppShell>
      <SectionTitle
        title="Skill Lab"
        subtitle="Each course here maps to a specific gap the model detected in your profile."
      />

      <Card className="mb-6">
        <div className="flex items-center justify-between">
          <p className="font-medium">Enrolment progress</p>
          <span className="text-sm font-semibold">
            {savedCourses.length} / {all.length} courses
          </span>
        </div>
        <ProgressBar
          value={all.length ? (savedCourses.length / all.length) * 100 : 0}
          tone="success"
          className="mt-4"
        />
      </Card>

      <div className="space-y-8">
        {careers.slice(0, 3).map((c) => (
          <section key={c.id}>
            <h2 className="mb-4 text-xl font-semibold">
              For {c.title}{" "}
              <span className="text-sm font-normal text-muted-foreground">
                ({c.confidence}% match)
              </span>
            </h2>
            <div className="grid gap-4 lg:grid-cols-3">
              {c.courses.map((course) => {
                const saved = savedCourses.includes(course.id);
                return (
                  <Card key={course.id} className="flex flex-col">
                    <div className="flex items-center justify-between">
                      <Chip tone="neutral">{course.level}</Chip>
                      <span className="text-sm text-muted-foreground">{course.duration}</span>
                    </div>
                    <h3 className="mt-4 text-lg font-semibold">{course.title}</h3>
                    <p className="text-sm text-muted-foreground">{course.provider}</p>
                    <p className="mt-3 flex-1 text-[15px] text-muted-foreground">{course.reason}</p>
                    <div className="mt-5 flex gap-2">
                      <Button
                        size="sm"
                        variant={saved ? "soft" : "primary"}
                        className="flex-1"
                        onClick={() => toggleCourse(course.id, course.title)}
                      >
                        {saved ? <BookmarkCheck className="size-4" /> : <Bookmark className="size-4" />}
                        {saved ? "Enrolled" : "Enroll"}
                      </Button>
                      <a href={course.url} target="_blank" rel="noreferrer">
                        <Button size="sm" variant="outline" aria-label={`Open ${course.title}`}>
                          <ExternalLink className="size-4" />
                        </Button>
                      </a>
                    </div>
                  </Card>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </AppShell>
  );
}
