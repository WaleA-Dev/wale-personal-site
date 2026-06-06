export default function ResumePage() {
  return (
    <main className="fixed inset-0 pt-16 flex flex-col bg-background">
      <div className="flex-1 relative">
        <iframe
          src="/resume.pdf"
          className="absolute inset-0 w-full h-full border-0"
          title="Adewale Adekambi — Resume"
        />
      </div>
    </main>
  );
}
