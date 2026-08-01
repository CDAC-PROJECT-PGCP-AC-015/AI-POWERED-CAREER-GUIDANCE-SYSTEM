import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { courses, mentors, users } from "../db/schema.js";

async function upsertUserByEmail(
  email: string,
  fullName: string,
  role: "student" | "mentor" | "admin",
  passwordHash: string,
) {
  const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing) return existing;
  const [created] = await db.insert(users).values({ email, passwordHash, fullName, role }).returning();
  return created;
}

/**
 * The 31 career classes the trained career_xgboost_model.pkl actually
 * predicts over (see ml-service/app.py / career_guidance_model.ipynb Step 10
 * — `career_classes`). Every one of these gets 3 seeded mentors below so the
 * mentor directory (GET /api/mentors?career=...) always has someone to show,
 * regardless of which of the 31 careers a student gets matched to.
 */
const CAREERS: { title: string; companies: string[]; tags: string[] }[] = [
  { title: "Backend Developer", companies: ["Amazon", "Flipkart", "Razorpay"], tags: ["Node.js", "Java", "System Design", "APIs"] },
  { title: "Blockchain Developer", companies: ["Polygon", "CoinDCX", "Consensys"], tags: ["Solidity", "Web3", "Smart Contracts"] },
  { title: "Business Analyst", companies: ["Deloitte", "Accenture", "TCS"], tags: ["Requirement Gathering", "SQL", "Power BI"] },
  { title: "Cloud Architect", companies: ["AWS", "Google Cloud", "Microsoft"], tags: ["AWS", "Azure", "Cloud Architecture"] },
  { title: "Computer Vision Engineer", companies: ["Nvidia", "Qualcomm", "Samsung R&D"], tags: ["OpenCV", "PyTorch", "Computer Vision"] },
  { title: "Cybersecurity Analyst", companies: ["Palo Alto Networks", "TCS", "Wipro"], tags: ["SOC", "SIEM", "Network Security"] },
  { title: "Data Analyst", companies: ["Deloitte", "Myntra", "PhonePe"], tags: ["SQL", "Excel", "Power BI", "Data Analysis"] },
  { title: "Data Engineer", companies: ["Uber", "Swiggy", "Grab"], tags: ["Spark", "Airflow", "Data Engineering"] },
  { title: "Data Scientist", companies: ["Google", "Amazon", "Fractal Analytics"], tags: ["Machine Learning", "Python", "Statistics"] },
  { title: "Database Administrator", companies: ["Oracle", "IBM", "TCS"], tags: ["PostgreSQL", "MySQL", "Database Tuning"] },
  { title: "DevOps Engineer", companies: ["Microsoft", "Atlassian", "Freshworks"], tags: ["Docker", "Kubernetes", "CI/CD"] },
  { title: "Embedded Systems Engineer", companies: ["Bosch", "Texas Instruments", "Qualcomm"], tags: ["C/C++", "RTOS", "Embedded Systems"] },
  { title: "Financial Analyst", companies: ["Goldman Sachs", "JPMorgan", "ICICI Bank"], tags: ["Financial Modeling", "Excel", "Valuation"] },
  { title: "Frontend Developer", companies: ["Zomato", "Meesho", "CRED"], tags: ["React", "TypeScript", "CSS"] },
  { title: "Full Stack Developer", companies: ["Razorpay", "Zerodha", "Postman"], tags: ["React", "Node.js", "Full Stack Development"] },
  { title: "Game Developer", companies: ["Nazara", "Zynga", "Ubisoft"], tags: ["Unity", "C#", "Game Development"] },
  { title: "IT Project Manager", companies: ["Infosys", "Capgemini", "Cognizant"], tags: ["Agile", "Scrum", "Project Management"] },
  { title: "IT Support Engineer", companies: ["TCS", "Wipro", "HCL"], tags: ["Troubleshooting", "Networking", "IT Support"] },
  { title: "Machine Learning Engineer", companies: ["Google", "Microsoft", "Meta"], tags: ["Machine Learning", "MLOps", "Python"] },
  { title: "Mobile App Developer", companies: ["Paytm", "PhonePe", "Ola"], tags: ["Kotlin", "Swift", "React Native"] },
  { title: "NLP Engineer", companies: ["Google", "Haptik", "Yellow.ai"], tags: ["NLP", "Transformers", "Python"] },
  { title: "Network Engineer", companies: ["Cisco", "Airtel", "Jio"], tags: ["Networking", "CCNA", "Network Security"] },
  { title: "Penetration Tester", companies: ["Deloitte", "EY", "TCS"], tags: ["Ethical Hacking", "OWASP", "Network Security"] },
  { title: "Product Manager", companies: ["Flipkart", "Swiggy", "CRED"], tags: ["Product Strategy", "Roadmapping", "Agile"] },
  { title: "QA Engineer", companies: ["Infosys", "Zoho", "Freshworks"], tags: ["Selenium", "Test Automation", "QA"] },
  { title: "Robotics Engineer", companies: ["Bosch", "Tata Elxsi", "ISRO"], tags: ["ROS", "Robotics", "C++"] },
  { title: "Site Reliability Engineer", companies: ["Google", "Netflix", "Freshworks"], tags: ["SRE", "Kubernetes", "Monitoring"] },
  { title: "Solutions Architect", companies: ["AWS", "IBM", "Accenture"], tags: ["System Design", "Cloud Architecture", "Solutions Architecture"] },
  { title: "Systems Administrator", companies: ["TCS", "Wipro", "HCL"], tags: ["Linux", "Windows Server", "Systems Administration"] },
  { title: "Technical Writer", companies: ["Atlassian", "Postman", "Zoho"], tags: ["Documentation", "API Docs", "Technical Writing"] },
  { title: "UI/UX Designer", companies: ["Swiggy", "CRED", "Zomato"], tags: ["Figma", "User Research", "UI/UX Design"] },
];

const FIRST_NAMES = [
  "Priya", "Rahul", "Ananya", "Vikram", "Sneha", "Arjun", "Kavya", "Rohit", "Divya", "Aditya",
  "Meera", "Karan", "Neha", "Suresh", "Pooja", "Amit", "Ritu", "Sanjay", "Ishaan", "Tanvi",
  "Nikhil", "Shreya", "Manish", "Priyanka", "Varun", "Deepika", "Rajesh", "Kiran", "Sameer", "Anjali",
];
const LAST_NAMES = [
  "Sharma", "Mehta", "Nair", "Rao", "Iyer", "Kulkarni", "Menon", "Patil", "Verma", "Reddy",
  "Gupta", "Malhotra", "Chopra", "Bose", "Pillai", "Joshi", "Desai", "Kapoor", "Bhatt", "Krishnan",
];
const SENIORITIES = ["Senior", "Staff", "Lead", "Principal"];

function nameFor(seed: number) {
  return `${FIRST_NAMES[seed % FIRST_NAMES.length]} ${LAST_NAMES[(seed * 7) % LAST_NAMES.length]}`;
}

function buildMentorSeeds() {
  const seeds: {
    email: string;
    fullName: string;
    title: string;
    company: string;
    expertiseTags: string[];
    bio: string;
    slots: string[];
  }[] = [];

  let i = 0;
  for (const career of CAREERS) {
    for (let slot = 0; slot < 3; slot++) {
      const fullName = nameFor(i);
      const seniority = SENIORITIES[slot % SENIORITIES.length];
      const company = career.companies[slot % career.companies.length];
      const emailSlug = fullName.toLowerCase().replace(/\s+/g, ".");
      seeds.push({
        email: `${emailSlug}.${i}@cdac.demo`,
        fullName,
        title: `${seniority} ${career.title}`,
        company,
        expertiseTags: [career.title, ...career.tags],
        bio: `${seniority} ${career.title} at ${company}. Happy to help with interview prep, resume review and day-to-day questions about breaking into ${career.title} roles.`,
        slots: [
          `${["Mon", "Tue", "Wed", "Thu", "Fri"][i % 5]} ${["6:00 PM – 6:45 PM", "7:00 PM – 7:45 PM", "8:00 PM – 8:45 PM"][slot]}`,
        ],
      });
      i++;
    }
  }
  return seeds;
}

async function main() {
  const passwordHash = await bcrypt.hash("Password123!", 12);

  const admin = await upsertUserByEmail("admin@cdac.demo", "Admin", "admin", passwordHash);
  console.log("Seeded admin:", admin.email, "(password: Password123!)");

  const mentorSeeds = buildMentorSeeds();
  let created = 0;
  for (const m of mentorSeeds) {
    const user = await upsertUserByEmail(m.email, m.fullName, "mentor", passwordHash);
    const [existingMentor] = await db.select().from(mentors).where(eq(mentors.userId, user.id)).limit(1);
    if (!existingMentor) {
      await db.insert(mentors).values({
        userId: user.id,
        title: m.title,
        company: m.company,
        expertiseTags: m.expertiseTags,
        bio: m.bio,
        slots: m.slots,
        availability: true,
      });
      created++;
    }
  }
  console.log(
    `Seeded ${created} new mentors (${mentorSeeds.length} total across ${CAREERS.length} careers, 3 each). Password: Password123!`,
  );

  const courseSeeds = [
    { title: "Machine Learning Specialization", platform: "Coursera", careerTag: "Data Scientist", url: "https://www.coursera.org/specializations/machine-learning-introduction" },
    { title: "The Complete Web Developer Course", platform: "Udemy", careerTag: "Software Engineer", url: "https://www.udemy.com/" },
    { title: "Deep Learning", platform: "NPTEL", careerTag: "Machine Learning Engineer", url: "https://nptel.ac.in/course.html" },
    { title: "AWS Certified Solutions Architect", platform: "Coursera", careerTag: "Solutions Architect", url: "https://www.coursera.org/" },
    { title: "Docker & Kubernetes: The Complete Guide", platform: "Udemy", careerTag: "DevOps Engineer", url: "https://www.udemy.com/" },
    { title: "Google Data Analytics Certificate", platform: "Coursera", careerTag: "Data Analyst", url: "https://www.coursera.org/professional-certificates/google-data-analytics" },
  ];
  for (const c of courseSeeds) {
    const [existing] = await db.select().from(courses).where(eq(courses.title, c.title)).limit(1);
    if (!existing) await db.insert(courses).values(c);
  }
  console.log(`Seeded ${courseSeeds.length} courses`);

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
