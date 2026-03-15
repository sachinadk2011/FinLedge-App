function ResultPanel({ result }) {
  return (
    <section className="card">
      <h2>API Result</h2>
      <pre>{result}</pre>
    </section>
  );
}

export default ResultPanel;
