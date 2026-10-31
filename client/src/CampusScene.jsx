export default function CampusScene({ className = "" }) {
  return (
    <svg
      className={`campus-scene ${className}`}
      viewBox="0 0 320 190"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="248" cy="47" r="26" fill="currentColor" opacity=".13" />
      <path
        d="M23 163h274M69 162V76l91-43 91 43v86M58 78l102-49 102 49M140 161v-38h40v38M91 91h22v22H91zM147 77h26v26h-26zM207 91h22v22h-22zM91 130h22v20H91zM207 130h22v20h-22z"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M160 29V12m0 0h35l-8 9h-27M39 160v-31m0 0c-22 0-22-34 0-34s22 34 0 34Zm239 31v-24m0 0c-18 0-18-28 0-28s18 28 0 28Z"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="m146 174-9 9m37-9 9 9M159 44l-37 18h75l-38-18Z"
        fill="currentColor"
        opacity=".18"
      />
      <path
        d="m268 62 5 5 11-12M31 58h12m-6-6v12"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}
