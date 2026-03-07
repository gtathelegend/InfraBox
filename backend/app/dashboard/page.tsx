import { getSession } from '@auth0/nextjs-auth0';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export default async function Dashboard() {
  // Use getSession to securely obtain the active session
  const session = await getSession();
  
  // Protect the route by demanding a valid session
  if (!session?.user) {
    redirect('/');
  }

  const { user } = session;

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center dark:bg-black font-sans">
      <div className="max-w-xl w-full p-8 bg-white dark:bg-gray-900 shadow-md rounded-xl">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold dark:text-white text-gray-800">Dashboard</h1>
          <Link 
            href="/api/auth/logout"
            className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded transition"
          >
            Logout
          </Link>
        </div>
        
        <div className="flex gap-4 items-center bg-gray-100 dark:bg-gray-800 p-4 rounded-lg mb-6">
          {user.picture && (
            <img 
              src={user.picture} 
              alt={user.name || 'User Avatar'} 
              className="w-16 h-16 rounded-full"
            />
          )}
          <div>
            <h2 className="text-xl font-semibold dark:text-gray-100">{user.name}</h2>
            <p className="text-gray-600 dark:text-gray-400">{user.email}</p>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">Session Details</h3>
          <pre className="bg-gray-100 dark:bg-gray-800 p-4 rounded text-sm text-gray-800 dark:text-gray-200 overflow-auto">
            {JSON.stringify(user, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}
