import Link from "next/link";
import { useUser } from "@auth0/nextjs-auth0/client";

export default function LoginButtons() {
  const { user, error, isLoading } = useUser();

  if (isLoading) return <div>Loading authentication...</div>;
  if (error) return <div>Auth Error: {error.message}</div>;

  if (user) {
    return (
      <div className="flex flex-col gap-4 items-center">
        <div className="flex items-center gap-4">
          {user.picture && (
            <img src={user.picture} alt={user.name!} className="w-10 h-10 rounded-full" />
          )}
          <span>Welcome, {user.name}</span>
        </div>
        <Link 
          href="/api/auth/logout" 
          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition"
        >
          Logout
        </Link>
      </div>
    );
  }

  // To target specific identity providers, we append standard connection parameters
  // which Auth0 recognizes if configured.
  return (
    <div className="flex flex-col gap-4 items-center w-full max-w-sm">
      <h2 className="text-xl font-bold mb-4">Sign in to InfraBox</h2>
      
      <Link 
        href="/api/auth/login?authorizationParams[connection]=google-oauth2"
        className="w-full text-center px-4 py-3 border border-gray-300 rounded hover:bg-gray-50 dark:hover:bg-gray-800 transition flex items-center justify-center gap-2"
      >
        Login with Google
      </Link>
      
      <Link 
        href="/api/auth/login?authorizationParams[connection]=github"
        className="w-full text-center px-4 py-3 bg-gray-900 text-white rounded hover:bg-gray-800 transition flex items-center justify-center gap-2"
      >
        Login with GitHub
      </Link>
      
      <Link 
        href="/api/auth/login?authorizationParams[connection]=Username-Password-Authentication"
        className="w-full text-center px-4 py-3 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition flex items-center justify-center gap-2"
      >
        Login with Email
      </Link>
    </div>
  );
}
