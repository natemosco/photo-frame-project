import Image from "next/image";
import { Geist, Geist_Mono } from "next/font/google";
import { useSession, signIn, signOut } from "next-auth/react";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function Home() {

  const { data: session, status } = useSession();

  if ( status === "loading" ) {
    return <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">Loading...</div>;
  }


    return (
      <main className="flex min-h-screen flex-col items-center justify-between p-24">
        <h1> Photo Frame Project </h1>
        {
          !session ? (
            <button style={{ backgroundColor: "blue", color: "white", padding: "10px 20px", borderRadius: "5px", cursor: "pointer" }} onClick={() => signIn("google")}>Sign in with Google</button>
          ) : (
            <div>
              <Image src={session.user?.image ?? ""} alt="User Image" width={100} height={100} />
              <p>Signed in as {session.user?.email}</p>
              <button onClick={() => signOut()}>Sign out</button>
            </div>
          )
        }
       
      </main>
    );
  
}
