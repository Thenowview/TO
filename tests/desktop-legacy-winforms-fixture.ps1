
Add-Type -AssemblyName System.Windows.Forms
$form = New-Object System.Windows.Forms.Form
$form.Text = 'GIZE legacy WinForms fixture'
$form.Width = 520; $form.Height = 240
$edit = New-Object System.Windows.Forms.TextBox
$edit.Name = 'FixtureInput'; $edit.AccessibleName = 'Fixture input'
$edit.Location = New-Object System.Drawing.Point(20,20); $edit.Width = 440
$private = New-Object System.Windows.Forms.TextBox
$private.AccessibleName = 'Private fixture'; $private.UseSystemPasswordChar = $true
$private.Location = New-Object System.Drawing.Point(20,55); $private.Width = 440
$button = New-Object System.Windows.Forms.Button
$button.Text = 'Apply synthetic value'; $button.AccessibleName = 'Apply synthetic value'
$button.Location = New-Object System.Drawing.Point(20,95); $button.Width = 220
$status = New-Object System.Windows.Forms.Label
$status.Text = 'Awaiting synthetic input'; $status.AutoSize = $true
$status.Location = New-Object System.Drawing.Point(20,145)
$button.Add_Click({
  if ($edit.Text -ceq 'Synthetic input verified') { $status.Text = 'Synthetic saved' }
  else { $status.Text = 'Unexpected synthetic input' }
})
$form.Controls.AddRange(@($edit,$private,$button,$status))
$form.TopMost = $true
[void]$form.ShowDialog()
