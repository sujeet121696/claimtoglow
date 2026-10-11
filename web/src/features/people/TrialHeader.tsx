// Page header for pages that save photos: whose trial, which product, which side, and what kind of
// photo is being saved. The kind lives in the URL (/capture?kind=noise) so links can point at it.
import { useRoute, type Page } from "../../app/router";
import type { Person } from "../../api/types";
import { PageHeader } from "../../components/ui";
import { KINDS, personLabel, sideShort, type Kind } from "../../domain/trial";
import { KindPicker } from "./KindPicker";

export function useKind(): Kind {
  const [route] = useRoute();
  const kind = route.params.get("kind");
  return kind && kind in KINDS ? (kind as Kind) : "trial";
}

export function TrialHeader({ page, title, person, kind }: { page: Page; title: string; person: Person; kind: Kind }) {
  const [, go] = useRoute();
  return (
    <PageHeader
      title={title}
      description={
        <>
          <b>{personLabel(person.person)}</b> · {person.product || "no product set"} · treated {sideShort(person.treated_side)}
          <br />
          <span className="small">{KINDS[kind].hint}.</span>
        </>
      }
      actions={<KindPicker person={person} value={kind} onChange={(k) => go(page, { kind: k })} />}
    />
  );
}
