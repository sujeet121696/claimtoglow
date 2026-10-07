// Home: one card per person with today's to-dos. Also checks photos copied in by hand.
import { useEffect } from "react";
import { useStore } from "../../app/store";
import { Empty, PageHeader } from "../../components/ui";
import { checkUnchecked } from "../../lib/gateBackfill";
import { PersonCard } from "./PersonCard";
import "./today.css";

export function TodayPage() {
  const { people, today, refresh, edit } = useStore();
  const ids = people.map((p) => p.person).join();

  useEffect(() => {
    if (!ids) return;
    (async () => {
      let checked = 0;
      for (const id of ids.split(",")) {
        for (const kind of ["trial", "noise"]) checked += await checkUnchecked(`${kind}-${id}`).catch(() => 0);
      }
      if (checked) refresh();
    })();
  }, [ids, refresh]);

  const date = new Date(today).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });

  return (
    <>
      <PageHeader
        title="Today"
        description={`${date}. Each person needs today's photo; repeat photos are needed once.`}
        actions={<button onClick={() => edit("new")}>＋ Add person</button>}
      />
      {people.length ? (
        <div className="people-grid">{people.map((p) => <PersonCard key={p.person} person={p} />)}</div>
      ) : (
        <Empty>No one yet. Add the first person to start a trial.</Empty>
      )}
    </>
  );
}
