import type { Person } from "../../api/types";
import { Segmented } from "../../components/ui";
import { dayStem, KINDS, type Kind } from "../../domain/trial";

/** What the next photo is: today's check-in or a repeat photo for the noise floor. */
export function KindPicker({ person, value, onChange }: { person: Person; value: Kind; onChange: (k: Kind) => void }) {
  const count: Record<Kind, string> = {
    trial: person.day === null ? "" : person.today_done ? "done" : dayStem(person.day),
    noise: `${person.noise_count}/${person.noise_target}`,
  };
  return (
    <Segmented
      value={value}
      onChange={onChange}
      options={(Object.keys(KINDS) as Kind[]).map((k) => ({
        value: k,
        title: KINDS[k].hint,
        label: <>{KINDS[k].label}{count[k] && <span className="seg-count">{count[k]}</span>}</>,
      }))}
    />
  );
}
