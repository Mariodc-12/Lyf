import { Link } from 'react-router-dom';
import Icon from './Icon.jsx';
import ExampleBudget from './ExampleBudget.jsx';

// Every signed-out form sits in this frame: a form on the left, the product on the right (laptops only).
export default function AuthShell({ title, sub, children, error }) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <main className="flex min-h-screen flex-col px-6 py-7 sm:px-12">
        <Link to="/" className="display w-fit text-3xl" aria-label="Lyf home">Lyf</Link>
        <div className="m-auto w-full max-w-sm py-10">
          <h1 className="display text-4xl leading-[1.05]">{title}</h1>
          {sub && <p className="mt-3 text-ink/65">{sub}</p>}
          <div className="mt-8">{children}</div>
          {error && (
            <p role="alert" className="mt-5 flex items-start gap-2 rounded-xl bg-hibiscus-tint px-4 py-3 text-sm font-medium text-hibiscus-deep">
              <Icon name="alert" size={18} className="mt-0.5 shrink-0" />
              {error}
            </p>
          )}
        </div>
      </main>
      <aside className="adire hidden items-center justify-center p-12 lg:flex" aria-hidden="true">
        <div className="w-full max-w-md">
          <ExampleBudget />
          <p className="mt-6 text-center text-sm text-white/70">Set a budget, book vendors, pay a deposit. All in one place.</p>
        </div>
      </aside>
    </div>
  );
}
