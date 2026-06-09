import Link from "next/link";

type PolicySection = {
  title: string;
  body: string[];
};

type PolicyPageProps = {
  eyebrow: string;
  title: string;
  description: string;
  updatedAt: string;
  sections: PolicySection[];
};

export function PolicyPage({ eyebrow, title, description, updatedAt, sections }: PolicyPageProps) {
  return (
    <main className="policy-page">
      <section className="policy-hero">
        <Link className="policy-home" href="/">
          정비 렌탈 운영
        </Link>
        <span>{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
        <small>최종 업데이트: {updatedAt}</small>
      </section>

      <section className="policy-content">
        {sections.map((section) => (
          <article key={section.title} className="policy-section">
            <h2>{section.title}</h2>
            {section.body.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </article>
        ))}
      </section>
    </main>
  );
}
