import LoginButtons from "./components/LoginButtons";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 font-sans dark:bg-black">
      <main className="flex w-full max-w-md flex-col items-center justify-center p-8 bg-white dark:bg-gray-900 shadow rounded-xl">
        <h1 className="text-3xl font-bold mb-8 text-center text-gray-900 dark:text-white">
          InfraBox Platform
        </h1>
        <LoginButtons />
      </main>
    </div>
  );
}
