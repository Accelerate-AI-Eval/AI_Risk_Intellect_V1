import { useEffect } from "react";
import { setDocumentPageTitle } from "../../utils/pageTitle";
import { PageHeading } from "./PageHeading";

type ShellPageProps = {
  title: string;
};

/** Simple main-area placeholder until real module pages exist. */
export function ShellPage({ title }: ShellPageProps) {
  useEffect(() => {
    setDocumentPageTitle(title);
  }, [title]);

  return (
    <main className="mainLayout__content">
      <PageHeading className="mainLayout__pageTitle">{title}</PageHeading>
      <p className="mainLayout__pageHint">
        In Progress
      </p>
    </main>
  );
}
