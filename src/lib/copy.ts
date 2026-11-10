/** Marketing copy shared by the homepage and the sign-in pages. */
export const PRICE = "₱1,998";
export type Side = "seeker" | "company";

export const PERKS: Record<Side, { title: string; lede: string; items: [string, string][] }> = {
  seeker: {
    title: "Job hunting without the busywork.",
    lede: "Daliapply works like a dating app for jobs. Here's what you don't get anywhere else.",
    items: [
      ["Upload once, never fill a form again", "We read your skills and years per skill from your resume. A right swipe is your application."],
      ["No more ghosting", "You only chat with companies that already said yes to you."],
      ["Salary before you swipe", "Every job tells you if its pay fits your range, so you never apply blind."],
      ["See why you matched", 'Each job shows how your experience fits, like "PHP 6 yrs ✓".'],
      ["Job hunt in private", "Your name and photo stay hidden until you match, so your current boss won't stumble on you."],
      ["Hide companies you don't like", "One tap and their jobs disappear for 30 days."],
    ],
  },
  company: {
    title: "Hire people who actually want the job.",
    lede: "Skip the pile of 300 applications. Daliapply sends you candidates who fit and are interested.",
    items: [
      ["Only candidates who fit", "Salary, location and languages are checked for you. The rest are ranked by years in each skill."],
      ["Every match wants the job", "A match means they swiped right on your job too."],
      ["Search the way you talk", 'Type "PHP 5 years, management 2 years" and get a ranked list.'],
      ["Skills first, bias out", "No name, photo, age or gender until it's a match, so you judge the experience."],
      ["Real people", "Seekers confirm their email, and a Verified badge shows who has passed an ID check."],
      [`${PRICE} per job post`, "No subscription and no seat fees. Pay only when you post, by GCash or InstaPay."],
    ],
  },
};

export const HOOKS: Record<Side, [string, string][]> = {
  seeker: [
    ["Tired of filling out the same form 50 times?", "Upload your resume once. A right swipe is your whole application."],
    ["Applied to 100 jobs and heard back from none?", "You only talk to companies that already said yes to you."],
    ["Is that job even in your salary range?", "Every card tells you before you swipe."],
    ["Sick of seeing the same company every day?", "Hide them for 30 days with one tap."],
    ["Worried your boss will see you're looking?", "Your name stays hidden until you match."],
    ["Wondering why a job was picked for you?", 'Every card shows how your skills fit, like "PHP 6 yrs ✓".'],
  ],
  company: [
    ["Drowning in applications that don't fit?", "You only see candidates who match your salary, skills and languages, best first."],
    ["Interviewed someone who never wanted the job?", "Every match swiped right on your job too."],
    ["Paying monthly for job boards you barely use?", `It's ${PRICE} per job post. No subscription.`],
    ["Want to judge skills, not names?", "Candidates stay anonymous until you match."],
    ["Tired of fake profiles?", "Seekers confirm their email, and a Verified badge shows who passed an ID check."],
    ["Hate writing search filters?", 'Type "PHP 5 years, management 2 years" and we rank people for you.'],
  ],
};

export const STEPS: Record<Side, [string, string][]> = {
  seeker: [["Upload your resume", "We read your skills, years, salary and languages."], ["Swipe on jobs", "Right if you're interested, left if not."], ["Match and chat", "When the company says yes too, names unlock and you can talk."]],
  company: [["Post a job", `Add the skills and years you need. ${PRICE} per post.`], ["Swipe on candidates", "Ranked by fit, with names hidden."], ["Match and chat", "When they say yes too, you see their full resume and can talk."]],
};

export const FAQ: Record<string, [string, string][]> = {
  "For job seekers": [
    ["Is Daliapply free for job seekers?", `Yes. Seekers never pay. Companies pay ${PRICE} per job post.`],
    ["How do I apply?", "Upload your resume once. We read your skills, years per skill, salary and languages. After that, a right swipe on a job is your application."],
    ["Who can see my name and resume?", 'Before a match, companies see a masked name like "O*** B*****", your headline, skills and years. Your name, salary, email and resume unlock only for a company you\'ve matched with.'],
    ["What is a match?", "A match happens when you swipe right on a job and the company swipes right on you. Then you can chat, and we email you both."],
    ["Why don't I see any jobs?", "Jobs only show if your salary range, country or remote preference, and languages fit. Update your profile to see more."],
    ["How many jobs can I swipe right on?", "Up to 25 a day, so every right swipe means something. Left swipes are unlimited."],
    ["Can I stop seeing a company?", 'Yes. Tap ⋯ on a job card and choose "Hide this company". Their jobs disappear for 30 days.'],
    ["What does Verified mean?", "You confirmed your email and we checked a government ID. Companies see a Verified badge. We delete your ID photo as soon as it's reviewed."],
    ["How do I delete my account?", "Open your Profile and scroll down to Your account."],
  ],
  "For companies": [
    ["How much does it cost?", `${PRICE} per job post. No subscription. Each post stays live for 30 days.`],
    ["How do I pay?", "Scan the GCash QR code on the payment page with GCash or any InstaPay banking app, then send the reference number and a receipt screenshot from the same page. We publish the post once we confirm the payment, usually within one business day."],
    ["Can I get a refund?", "If we can't confirm your payment or we reject the post, we refund the full amount. Once a post is live the fee isn't refundable."],
    ["Why can't I sign up with Gmail?", "Companies sign up with a work email on their own domain, so seekers know the company is real."],
    ["How do I find the right people?", 'Open a job and type what you need, like "PHP 5 years, management 2 years". Candidates are ranked by how well their years in each skill fit.'],
    ["What happens after 30 days?", "The post stops showing to seekers. You can renew it for another 30 days. Your matches and chats stay."],
    ["I already hired someone. How do I close the job?", 'Open the job and tap "Position filled". Seekers stop seeing it right away.'],
  ],
};
