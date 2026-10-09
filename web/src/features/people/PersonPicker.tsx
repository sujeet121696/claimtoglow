import { DEMO } from "../../app/mode";
import { useStore } from "../../app/store";
import { personLabel } from "../../domain/trial";

const NEW = "__new";

/** Header control: who we're working on. Every page follows this choice. */
export function PersonPicker() {
  const { people, person, selectPerson, edit } = useStore();
  return (
    <div className="person-picker">
      <select
        aria-label="Person"
        value={person?.person ?? ""}
        onChange={(e) => (e.target.value === NEW ? edit("new") : selectPerson(e.target.value))}
      >
        {people.map((p) => <option key={p.person} value={p.person}>{personLabel(p.person)}</option>)}
        {!DEMO && <option value={NEW}>＋ Add person…</option>}
      </select>
      {person && !DEMO && <button className="ghost" onClick={() => edit(person)}>Edit</button>}
    </div>
  );
}
