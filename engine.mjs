export function shuffle(items, rng = Math.random) {
  const out = [...items];
  for (let i=out.length-1;i>0;i--) {const j=Math.floor(rng()*(i+1)); [out[i],out[j]]=[out[j],out[i]];}
  return out;
}
export function selectQuestions(bank, lessons, count, rng=Math.random) {
  const buckets=shuffle(lessons,rng).map(l=>shuffle(bank.filter(q=>q.lesson===l),rng));
  const out=[];
  while(out.length<count && buckets.some(b=>b.length)) for(const b of buckets) if(b.length && out.length<count) out.push(b.pop());
  return shuffle(out,rng).map(q=>({...q,choices:shuffle(q.choices,rng)}));
}
export function grade(questions, answers) {
  const results=questions.map(q=>({question:q,answer:answers[q.id]??null,correct:answers[q.id]===q.answer}));
  return {results,correct:results.filter(r=>r.correct).length,total:results.length};
}
